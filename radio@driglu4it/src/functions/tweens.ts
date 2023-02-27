const { addTween, removeTweens } = imports.ui.tweener

export function createRotateAnimation(icon:imports.gi.St.Icon){

    let iconDestroyed = false

    const destroySignal = icon.connect('destroy', (actor) => {
        iconDestroyed = true
        actor.disconnect(destroySignal)
    })
    

    const tweenParams = {
        rotation_angle_z: 360,
        transition: "linear",
        time: 5,
        onComplete: () => {
            if (iconDestroyed) return

            icon.rotation_angle_z = 0
            addTween(icon, tweenParams)
        }, 
    }

    return {
        stopRotation: () => {
            if (iconDestroyed) return
            removeTweens(icon)
            icon.rotation_angle_z = 0
        },
        startResumeRotation: () =>  {
            if (iconDestroyed) return
            addTween(icon, tweenParams)
        }

    }

}