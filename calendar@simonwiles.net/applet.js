/*
 *   World Clock Calendar applet calendar@simonwiles.net
 *   Fork of the Cinnamon calendar applet with support for displaying multiple timezones.
 *   version 0.2
 */

const EXTENSION_UUID = "calendar@simonwiles.net";
const SCHEMA_NAME = "org.cinnamon.applets.sw_calendar";
const APPLET_DIR = imports.ui.appletManager.appletMeta[EXTENSION_UUID].path;

const Applet = imports.ui.applet;
const Calendar = imports.ui.calendar;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const UPowerGlib = imports.gi.UPowerGlib;
const Util = imports.misc.util;

let settings;

function _onVertSepRepaint(area) {
    let cr = area.get_context();
    let themeNode = area.get_theme_node();
    let [width, height] = area.get_surface_size();
    let stippleColor = themeNode.get_color('-stipple-color');
    let stippleWidth = themeNode.get_length('-stipple-width');
    let x = Math.floor(width/2) + 0.5;
    cr.moveTo(x, 0);
    cr.lineTo(x, height);
    Clutter.cairo_set_source_color(cr, stippleColor);
    cr.setDash([1, 3], 1); // Hard-code for now
    cr.setLineWidth(stippleWidth);
    cr.stroke();
};

function getSettings(schemaName, appletDir) {
    /* get settings from GSettings */
    let schemaDir = appletDir + '/schemas';

    // Check if schemas are available in .local or if it's installed system-wide
    if (GLib.file_test(schemaDir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
        schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir, Gio.SettingsSchemaSource.get_default(), false);
        let schema = schemaSource.lookup(schemaName, false);
        return new Gio.Settings({ settings_schema: schema });
    } else {
        if (Gio.Settings.list_schemas().indexOf(schemaName) == -1)
            throw "Schema \"%s\" not found.".format(schemaName);
        return new Gio.Settings({ schema: schemaName });
    }

};

function rpad(str, pad_with, length) {
    while (str.length < length) { str = str + pad_with; }
    return str;
}

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panel_height) {
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height);

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);

            this._metadata = metadata;
            this._orientation = orientation;

            this._initContextMenu();

            this._calendarArea = new St.BoxLayout({name: 'calendarArea' });
            this.menu.addActor(this._calendarArea);

            // Fill up the first column

            let vbox = new St.BoxLayout({vertical: true});
            this._calendarArea.add(vbox);

            // Date
            this._date = new St.Label();
            this._date.style_class = 'datemenu-date-label';
            vbox.add(this._date);

            this._eventSource = null;
            this._eventList = null;

            // Calendar
            this._calendar = new Calendar.Calendar(this._eventSource);
            vbox.add(this._calendar.actor);

            // World Clocks
            this._worldclocks = [];
            for (i in metadata.worldclocks) {
                let tz = new St.BoxLayout({vertical: false})
                let tz_label = new St.Label({ style_class: 'datemenu-date-label', text: metadata.worldclocks[i][0] });
                tz.add(tz_label, {x_align: St.Align.START, expand: true, x_fill: false})
                this._worldclocks[i] = new St.Label({ style_class: 'datemenu-date-label' });
                tz.add(this._worldclocks[i], {x_align: St.Align.END, expand: true, x_fill: false})
                vbox.add(tz);
            }

            // Done with hbox for calendar and event list

            // Track changes to clock settings
            this._calendarSettings = new Gio.Settings({ schema: 'org.cinnamon.calendar' });
            this._dateFormat = null;
            this._dateFormatFull = null;
            let getCalendarSettings = Lang.bind(this, function() {
                this._dateFormat = this._calendarSettings.get_string('date-format');
                this._dateFormatFull = this._calendarSettings.get_string('date-format-full');
                this._updateClockAndDate();
            });
            this._calendarSettings.connect('changed', getCalendarSettings);

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            this._upClient.connect('notify-resume', getCalendarSettings);

            // Start the clock
            getCalendarSettings();
            this._updateClockAndDatePeriodic();
            this.createContextMenu();

        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _onLaunchSettings: function() {
        this.menu.close();
        Util.spawnCommandLine("cinnamon-settings calendar");
    },

    _onLaunchWorldClockSettings: function() {
        this.menu.close();
        let settingsFile = APPLET_DIR + "/settings.py";
        Util.spawnCommandLine("python " + settingsFile);
    },

    _updateClockAndDate: function() {
        let displayDate = new Date();
        let dateFormattedFull = displayDate.toLocaleFormat(this._dateFormatFull);
        this.set_applet_label(displayDate.toLocaleFormat(this._dateFormat));

        let tooltip = [];
        for (i in this._metadata.worldclocks) {
            let tz = this.get_world_time(this._metadata.worldclocks[i][1])
            this._worldclocks[i].set_text(tz);
            tooltip.push(rpad(this._metadata.worldclocks[i][0], ' ', 20) + tz);
        }
        this.set_applet_tooltip(tooltip.join('\n'));

        if (dateFormattedFull !== this._lastDateFormattedFull) {
            this._date.set_text(dateFormattedFull);
            //this.set_applet_tooltip(dateFormattedFull);
            this._lastDateFormattedFull = dateFormattedFull;
        }
    },

    _updateClockAndDatePeriodic: function() {
        this._updateClockAndDate();
        this._periodicTimeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateClockAndDatePeriodic));
    },

    on_applet_removed_from_panel: function() {
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

    _initContextMenu: function () {
        if (this._calendarArea) this._calendarArea.unparent();
        if (this.menu) this.menuManager.removeMenu(this.menu);

        this.menu = new Applet.AppletPopupMenu(this, this._orientation);
        this.menuManager.addMenu(this.menu);

        if (this._calendarArea){
            this.menu.addActor(this._calendarArea);
            this._calendarArea.show_all();
        }

        // Whenever the menu is opened, select today
        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
            if (isOpen) {
                let now = new Date();
                /* Passing true to setDate() forces events to be reloaded. We
                 * want this behavior, because
                 *
                 *   o It will cause activation of the calendar server which is
                 *     useful if it has crashed
                 *
                 *   o It will cause the calendar server to reload events which
                 *     is useful if dynamic updates are not supported or not
                 *     properly working
                 *
                 * Since this only happens when the menu is opened, the cost
                 * isn't very big.
                 */
                this._calendar.setDate(now, true);
                // No need to update this._eventList as ::selected-date-changed
                // signal will fire
            }
        }));
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    },

    createContextMenu: function () {
        this._applet_context_menu.addMenuItem(new Applet.MenuItem(
            _('Date and Time Settings'), Gtk.STOCK_EDIT, Lang.bind(this, this._onLaunchSettings)));
        this._applet_context_menu.addMenuItem(new Applet.MenuItem(
            _('Edit World Clocks'), Gtk.STOCK_EDIT, Lang.bind(this, this._onLaunchWorldClockSettings)));
    },

    get_world_time: function(tz) {
        let env = GLib.environ_setenv (null, 'TZ', tz, 1)
        let [res, out, err, status] = GLib.spawn_sync(
                null, ['date', '+%_I:%M%P (%a)'], env, GLib.SpawnFlags.SEARCH_PATH, null);
        return out.toString().trim()
    },

};

function main(metadata, orientation, panel_height) {
    settings = getSettings(SCHEMA_NAME, APPLET_DIR);
    let myApplet = new MyApplet(metadata, orientation, panel_height);
    return myApplet;
}
