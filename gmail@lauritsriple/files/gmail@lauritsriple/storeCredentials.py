import keyring
import sys
if __name__ == "__main__":
    user=sys.argv[1]
    pwd=sys.argv[2]
    keyring.set_password("mailnotifier",user,pwd)
