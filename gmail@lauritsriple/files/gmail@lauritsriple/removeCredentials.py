import keyring
import sys
if __name__ == "__main__":
    user=sys.argv[1]
    try:
        keyring.delete_password("mailnotifier",user)
    except:
        #Do nothing
        print("Could not delete. Does user even exists")
