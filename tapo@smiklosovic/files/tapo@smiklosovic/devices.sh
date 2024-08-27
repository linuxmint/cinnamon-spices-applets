# 1 = url
# 2 = password
login()
{
    OUTPUT=$(curl -s -X POST -H "Content-Type: application/json" --data "{ \"password\": \"$2\" }" $1/login)
    if [ "$?" == 0 ]; then
        if [ "$OUTPUT" = "Invalid credentials provided" ]; then
          echo "error"
        elif [ "$OUTPUT" = "" ]; then
          echo "error"
        else
          echo -n $OUTPUT
        fi
    else
        echo "error"
    fi
}

# 1 = device name
# 2 = url
# 3 = token
get_status()
{
  OUTPUT=$(curl -s -X GET -H "Authorization: Bearer $3" "$2/actions/p110/get-device-info?device=$1")
  echo -n $OUTPUT | jq -j .device_on
}

# 1 = device
# 2 = url
# 3 = token
turn_on()
{
    curl -s -X GET -H "Authorization: Bearer $3" "$2/actions/p110/on?device=$1"
}

# 1 = device
# 2 = url
# 3 = token
turn_off()
{
    curl -s -X GET -H "Authorization: Bearer $3" "$2/actions/p110/off?device=$1"
}

# 1 = device
# 2 = url
# 3 = token
toggle_device()
{
  IS_ON=$(get_status $1 $2 $3)
  if [ "$IS_ON" = "true" ]; then
    turn_off $1 $2 $3
  else
    turn_on $1 $2 $3
  fi
}

if [ "$1" = "login" ]; then
  login $2 $3
elif [ "$2" = "off" ]; then
  # device token url
  turn_off $1 $3 $4
elif [ "$2" = "on" ]; then
  # device token url
  turn_on $1 $3 $4
elif [ "$2" = "status" ]; then
  # device token url
  get_status $1 $3 $4
else
  # device 
  toggle_device $1 $3 $4
fi
