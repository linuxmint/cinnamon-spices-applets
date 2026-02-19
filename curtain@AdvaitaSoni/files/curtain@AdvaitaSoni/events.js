const { WindowManager } = require("./window");
class EventManager {
    windowMgr;
    static inst;
    static get instance() {
        if (EventManager.inst) {
            return EventManager.inst;
        } else {
            return (EventManager.inst = new EventManager());
        }
    }

    constructor() {
        this.windowMgr = WindowManager.instance;
    }

    destroy() {
        this.windowMgr.destroy()
        this.windowMgr = null
        EventManager.inst = null;
    }

    arrange() {
        this.windowMgr.arrange()
    }

    focusToNextAlgorithmically() {
        this.windowMgr.focusNext()
    }

    swapToNextAlgorithmically() {
        this.windowMgr.swapNext()
    }

    moveInDirectionOfNextNode() {
        this.windowMgr.moveNext()
    }

    minimize() {
        this.windowMgr.minimize()
    }

    fullMaximize() {
        this.windowMgr.fullMaximize()
    }

    halfMaximize() {
        this.windowMgr.halfMaximize()
    }

    unmaximize() {
        this.windowMgr.unmaximize()
    }
    moveSwitchWorkspace1() {
        this.windowMgr.moveToWorkspace(1);
    }
    moveSwitchWorkspace2() {
        this.windowMgr.moveToWorkspace(2);
    }
    moveSwitchWorkspace3() {
        this.windowMgr.moveToWorkspace(3);
    }
    moveSwitchWorkspace4() {
        this.windowMgr.moveToWorkspace(4);
    }
    moveSwitchWorkspace5() {
        this.windowMgr.moveToWorkspace(5);
    }
    moveSwitchWorkspace6() {
        this.windowMgr.moveToWorkspace(6);
    }
    moveSwitchWorkspace7() {
        this.windowMgr.moveToWorkspace(7);
    }
    moveSwitchWorkspace8() {
        this.windowMgr.moveToWorkspace(8);
    }
    moveSwitchWorkspace9() {
        this.windowMgr.moveToWorkspace(9);
    }
    moveSwitchNextWorkspace() {
        let index = global.screen.get_active_workspace_index() + 1;
        this.windowMgr.moveToWorkspace(index + 1);
    }
    moveSwitchPrevWorkspace() {
        let index = global.screen.get_active_workspace_index() + 1;
        this.windowMgr.moveToWorkspace(index - 1);
    }

    //for switching
    switchWorkspace1() {
        this.windowMgr.switchWorkspace(1);
    }
    switchWorkspace2() {
        this.windowMgr.switchWorkspace(2);
    }
    switchWorkspace3() {
        this.windowMgr.switchWorkspace(3);
    }
    switchWorkspace4() {
        this.windowMgr.switchWorkspace(4);
    }
    switchWorkspace5() {
        this.windowMgr.switchWorkspace(5);
    }
    switchWorkspace6() {
        this.windowMgr.switchWorkspace(6);
    }
    switchWorkspace7() {
        this.windowMgr.switchWorkspace(7);
    }
    switchWorkspace8() {
        this.windowMgr.switchWorkspace(8);
    }
    switchWorkspace9() {
        this.windowMgr.switchWorkspace(9);
    }
    switchNextWorkspace() {
        let index = global.screen.get_active_workspace_index() + 1;
        this.windowMgr.switchWorkspace(index + 1);
    }
    switchPrevWorkspace() {
        let index = global.screen.get_active_workspace_index() + 1;
        this.windowMgr.switchWorkspace(index - 1);
    }
    kill() {
        this.windowMgr.closeWindow();
    }
}