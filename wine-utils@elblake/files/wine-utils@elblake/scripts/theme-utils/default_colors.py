
import math

def sh(a,b):
    return q(max(0.0,min(1.0, math.pow(a,1.0) + b)))

def q(a):
    return [round(255*a),round(255*a),round(255*a)]

def default_colors():
    c = {}
    c["MenuHeight"] = -450
    c["ScrollHeight"] = -240
    c["ActiveBorder"] = sh(0.0,0.0)
    c["ButtonAlternateFace"] = sh(0.0,0.5)
    c["ButtonDkShadow"] = sh(-0.4,0.6)
    c["ButtonFace"] = sh(0.0,0.6)
    c["ButtonHilight"] = sh(0.4,0.6)
    c["ButtonLight"] = sh(0.2,0.6)
    c["ButtonShadow"] = sh(-0.2,0.6)
    c["ButtonText"] = sh(0.0,0.1)
    c["GrayText"] = sh(0.0,0.35)
    c["Hilight"] = [0, 100, 220]
    c["InactiveTitleText"] = sh(0.0,0.15)
    c["InfoText"] = sh(0.0,0.0)
    c["InfoWindow"] = [220, 220, 130]
    c["Menu"] = sh(0.0,0.6)
    c["MenuBar"] = sh(0.0,0.6)
    c["MenuHilight"] = sh(0.0,0.15)
    c["MenuText"] = sh(0.0,0.0)
    c["Scrollbar"] = sh(0.0,0.4)
    c["Window"] = sh(0.0,0.8)
    c["WindowFrame"] = sh(0.0,0.2)
    c["WindowText"] = sh(0.0,0.1)

    for w in ["CaptionFont","MenuFont","MessageFont","StatusFont"]:
        c[w]=["MS Shell Dlg", 500, 10, 0]
    return c

