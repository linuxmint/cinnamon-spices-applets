#!/bin/bash


message1=$(date '+%a')
message2=$(date '+%H:%M')
message3=$(date '+%d-%m-%Y')

json=`cat <<EOF
{
	"json": "must be here",
	"appsettings": {
		"tooltip": "A clock"
	},
	"item": [
		{
			"type": "box",
			"attr": {
				"vertical": 1,
				"style": "border: 1px;border-color: rgb(40,40,40) ;padding: 1px;background-color: rgb(50,50,50)"
			},

			"item": [
				{
					"type": "box",
					"attr": {
						"xfill":0,
						"xalign":2
					},
					"item": [
						{
							"type": "text", 
							"value": "%message1 ",
							"attr": {
								"style": "font-size: 8pt;color:orange;font-weight:bold;"
							}
						}, {
							"type": "text",
							"value": "%message2",
							"attr": {
								"style": "font-size: 9pt;font-weight:bold"
							}
						}
					]
				}, {
					"type": "text",
					"value": "%message3",
					"attr": {
					        "style": "font-size: 7pt;color:orange;"
					}
				}
			]
		}
	]
}

EOF
`

json=${json/"%message1"/$message1}
json=${json/"%message2"/$message2}
json=${json/"%message3"/$message3}

echo "$json"
