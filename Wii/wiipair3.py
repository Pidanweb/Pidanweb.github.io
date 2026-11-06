# wiipair3.py -- Wiiリモコンを Windows に接続する
#
# 使い方:
#   py wiipair3.py            → 1+2方式・PIN認証(BluetoothAuthenticateDevice / コールバック無し)
#   py wiipair3.py 0 noauth   → 1+2方式・認証せずにHIDだけ有効化(一時接続。毎回実行が必要)
#   py wiipair3.py 0 sync     → 赤いSYNCボタン方式(PIN=PCのアドレス、恒久ペアリング)
#   最初の数字はラジオ番号
#
# wiipair2 からの変更点:
#   - コールバック(RegisterForAuthenticationEx + SendAuthenticationResponseEx)をやめた。
#     2 では Send がブロックして AuthenticateDeviceEx が 258 (WAIT_TIMEOUT) になっていた。
#   - 代わりに旧API BluetoothAuthenticateDevice に「生バイトを WCHAR に1個ずつ詰めた」
#     6文字のPINを直接渡す(Dolphin 等で実績のある方法)。
#   - スキャンを短くし、LED点滅(約20秒)の間に認証まで終わるようにした。
#   - GetLastError を正しく取得(use_last_error=True)。
import ctypes, sys, time, faulthandler, functools
faulthandler.enable()
print = functools.partial(print, flush=True)
from ctypes import (c_void_p, c_ubyte, c_ulong, c_ulonglong, c_ushort,
                    c_wchar, POINTER, byref, sizeof, Structure, Union)
from ctypes import wintypes as w

bt = ctypes.WinDLL("bthprops.cpl", use_last_error=True)

class BTH_ADDR(Union):
    _fields_ = [("ull", c_ulonglong), ("rg", c_ubyte * 6)]

class SYSTEMTIME(Structure):
    _fields_ = [(n, w.WORD) for n in ("y", "m", "dow", "d", "h", "mi", "s", "ms")]

class DEVINFO(Structure):
    _fields_ = [("dwSize", w.DWORD), ("Address", BTH_ADDR),
                ("cod", c_ulong), ("fConnected", w.BOOL),
                ("fRemembered", w.BOOL), ("fAuthenticated", w.BOOL),
                ("stLastSeen", SYSTEMTIME), ("stLastUsed", SYSTEMTIME),
                ("szName", c_wchar * 248)]

class SEARCH(Structure):
    _fields_ = [("dwSize", w.DWORD), ("fReturnAuthenticated", w.BOOL),
                ("fReturnRemembered", w.BOOL), ("fReturnUnknown", w.BOOL),
                ("fReturnConnected", w.BOOL), ("fIssueInquiry", w.BOOL),
                ("cTimeoutMultiplier", c_ubyte), ("hRadio", c_void_p)]

class FINDRADIO(Structure):
    _fields_ = [("dwSize", w.DWORD)]

class RADIOINFO(Structure):
    _fields_ = [("dwSize", w.DWORD), ("address", BTH_ADDR),
                ("szName", c_wchar * 248), ("cod", c_ulong),
                ("lmpSubversion", c_ushort), ("manufacturer", c_ushort)]

class GUID(Structure):
    _fields_ = [("d1", c_ulong), ("d2", c_ushort), ("d3", c_ushort),
                ("d4", c_ubyte * 8)]

HID_GUID = GUID(0x1124, 0, 0x1000,
                (c_ubyte * 8)(0x80, 0x00, 0x00, 0x80, 0x5F, 0x9B, 0x34, 0xFB))

bt.BluetoothFindFirstRadio.restype = c_void_p
bt.BluetoothFindFirstDevice.restype = c_void_p
bt.BluetoothFindNextDevice.argtypes = [c_void_p, POINTER(DEVINFO)]
bt.BluetoothFindDeviceClose.argtypes = [c_void_p]
bt.BluetoothFindRadioClose.argtypes = [c_void_p]
bt.BluetoothGetRadioInfo.argtypes = [c_void_p, POINTER(RADIOINFO)]
bt.BluetoothFindNextRadio.argtypes = [c_void_p, POINTER(c_void_p)]
bt.BluetoothAuthenticateDevice.argtypes = [
    c_void_p, c_void_p, POINTER(DEVINFO), POINTER(c_wchar), c_ulong]
bt.BluetoothSetServiceState.argtypes = [
    c_void_p, POINTER(DEVINFO), POINTER(GUID), w.DWORD]
bt.BluetoothRemoveDevice.argtypes = [POINTER(BTH_ADDR)]

RADIO_ADDRS = []

def addr_str(a):
    return ":".join("%02x" % b for b in reversed(bytes(a.rg)))

def list_radios():
    radios = []
    p = FINDRADIO(sizeof(FINDRADIO))
    h = c_void_p()
    hf = bt.BluetoothFindFirstRadio(byref(p), byref(h))
    if not hf:
        return radios
    while True:
        info = RADIOINFO(); info.dwSize = sizeof(RADIOINFO)
        bt.BluetoothGetRadioInfo(h, byref(info))
        print(f"[radio {len(radios)}] {addr_str(info.address)} name={info.szName!r}")
        RADIO_ADDRS.append(bytes(info.address.rg))
        radios.append(c_void_p(h.value))
        h = c_void_p()
        if not bt.BluetoothFindNextRadio(hf, byref(h)):
            break
    bt.BluetoothFindRadioClose(hf)
    return radios

def scan(hradio, timeout_mult=2):
    s = SEARCH(); s.dwSize = sizeof(SEARCH)
    s.fReturnAuthenticated = s.fReturnRemembered = 1
    s.fReturnUnknown = s.fReturnConnected = 1
    s.fIssueInquiry = 1
    s.cTimeoutMultiplier = timeout_mult          # x1.28秒
    s.hRadio = hradio
    info = DEVINFO(); info.dwSize = sizeof(DEVINFO)
    hf = bt.BluetoothFindFirstDevice(byref(s), byref(info))
    found = None
    if hf:
        while True:
            print(f"  found: {info.szName!r} {addr_str(info.Address)} "
                  f"connected={info.fConnected} auth={info.fAuthenticated} "
                  f"remembered={info.fRemembered}")
            if "Nintendo" in info.szName or "RVL" in info.szName:
                found = DEVINFO.from_buffer_copy(info)
            if not bt.BluetoothFindNextDevice(hf, byref(info)):
                break
        bt.BluetoothFindDeviceClose(hf)
    else:
        print("  (デバイスなし) err =", ctypes.get_last_error())
    return found

def main():
    radios = list_radios()
    if not radios:
        print("ラジオが見つかりません"); return
    idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    mode = sys.argv[2].lower() if len(sys.argv) > 2 else "auth"
    hradio = radios[idx]
    print("ラジオ:", idx, " モード:", mode)

    if mode == "sync":
        print("\n今すぐ 電池ボックス内の赤いSYNCボタンを押してください\n")
    else:
        print("\n今すぐ 1 と 2 を同時に押してください(LED点滅中に終わらせます)\n")

    dev = None
    for _ in range(6):                           # 約2.6秒 x 最大6回
        dev = scan(hradio)
        if dev:
            break
    if not dev:
        print("Wiiリモコンが見つかりません"); return

    if dev.fRemembered or dev.fAuthenticated:
        print("既存登録を削除:", bt.BluetoothRemoveDevice(byref(dev.Address)))
        print("→ 削除したので、もう一度 1+2(またはSYNC)を押し直して再実行してください")
        return

    if mode != "noauth":
        # PIN = PC(ラジオ)のアドレス 6バイト(逆順=rgそのまま)
        # SYNC方式・1+2方式どちらも Windows ではホスト側アドレスを使うのが一般的
        pin_bytes = RADIO_ADDRS[idx]
        if 0 in pin_bytes:
            print("注意: PINに 0x00 が含まれるため失敗する可能性があります")
        pin = (c_wchar * 6)(*[chr(b) for b in pin_bytes])
        print("PIN =", pin_bytes.hex(" "))
        err = bt.BluetoothAuthenticateDevice(None, hradio, byref(dev), pin, 6)
        print("AuthenticateDevice ->", err, "(0なら成功)")
        if err != 0:
            print("認証失敗。 `py wiipair3.py", idx, "noauth` も試してください")
            return

    err = bt.BluetoothSetServiceState(hradio, byref(dev), byref(HID_GUID), 1)
    print("SetServiceState(HID) ->", err, "(0なら成功)")
    if err == 0:
        print("\nLEDの点滅が止まり、デバイスマネージャーにHIDが出れば接続完了です")

main()
