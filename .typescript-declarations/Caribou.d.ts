declare namespace imports.gi.Caribou {

    interface KeyboardModelOptions {
        keyboard_type: string
    }

    class KeyboardModel {

        public keyboard_type: string
        public active_group: string

        constructor(options?: KeyboardModelOptions)

        public get_groups: string[]
        public get_group(groupName: string): GroupModel
    }

    class GroupModel {

    }
}