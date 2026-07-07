1.step es obligatorio cuando se trata de un spinbutton: The step function is mandatory when dealing with a spinbutton.
2. en caso de cambio en la estructura de settings-schema.json aplicar estos comandos (solo en caso de que despues de cambiar su estructura no abre la configuracion):
    # se borra la config  corrupta
    rm ~/.config/cinnamon/spices/systemmonitor@dannt/systemmonitor@dannt.json
    # Creamos la carpeta de configs antigua por si acaso
    mkdir -p ~/.cinnamon/configs/systemmonitor@dannt
    # Reiniciamos Cinnamon
    cinnamon --replace & disown

3. intentar : 
 on_applet_clicked: function(event) {
        this._runSysMon();
    },
     _runSysMon: function() {
        let _appSys = Cinnamon.AppSystem.get_default();
        let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
        if (_gsmApp != null)
            _gsmApp.activate();
        else if (GLib.find_program_in_path("gnome-system-monitor"))
            Util.spawnCommandLineAsync("gnome-system-monitor");
    },

    _runSysMonActivate: function() {
        this._runSysMon();
    }

on_applet_clicked: function(event) {
        if (this.cfg_onclick_program)
            GLib.spawn_command_line_async(this.cfg_onclick_program);
    },