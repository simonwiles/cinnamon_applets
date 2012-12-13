#!/usr/bin/env python
#-*- coding:utf-8 -*-

"""

v0.2 - switched to using metadata JSON to store settings, since I can't work
       out how to unpack a GVariant retreived from GSettings in GJS.  see:
       stackoverflow.com/questions/13736695/unpacking-gvariant-in-javascript

"""


from __future__ import unicode_literals

__program_name__ = 'settings.py'
__author__ = 'Simon Wiles'
__email__ = 'simonjwiles@gmail.com'
__copyright__ = 'Copyright 2012, Simon Wiles'
__license__ = 'GPL http://www.gnu.org/licenses/gpl.txt'
__date__ = '2012-12'

import codecs
import os
import subprocess
from gi.repository import Gtk, GLib  # pylint: disable-msg=E0611

# prefer simplejson if available (it's faster), and fallback to json
#  (included in the standard library for Python >= 2.6) if not.
try:
    import simplejson as json
except ImportError:
    import json

APPLET_DIR = os.path.dirname(os.path.abspath(__file__))
METADATA = json.load(codecs.open(
                       os.path.join(APPLET_DIR, 'metadata.json'), 'r', 'utf8'))
SETTINGS = None


def get_settings(schema_name):
    """ Get settings values from corresponding schema file """

    from gi.repository import Gio

    # Try to get schema from local installation directory
    schemas_dir = os.path.join(APPLET_DIR, 'schemas')
    if os.path.isfile(os.path.join(schemas_dir, 'gschemas.compiled')):
        schema_source = Gio.SettingsSchemaSource.new_from_directory(
                    schemas_dir, Gio.SettingsSchemaSource.get_default(), False)
        schema = schema_source.lookup(schema_name, False)
        return Gio.Settings.new_full(schema, None, None)
    else:
        # Schema is installed system-wide
        return Gio.Settings.new(schema_name)


def get_timezones():

    timezones_tab = '/usr/share/zoneinfo/zone.tab'
    if not os.path.exists(timezones_tab):
        timezones_tab = '/usr/share/lib/zoneinfo/tab/zone_sun.tab'

    if not os.path.exists(timezones_tab):
        return liststore_timezones

    timezones = subprocess.check_output(
                        ['/usr/bin/awk', '!/#/ {print $3}', timezones_tab])

    return sorted(timezones.strip('\n').split('\n'))


class SettingsWindow(Gtk.Window):
    """ Build settings panel window """

    def __init__(self):
        Gtk.Window.__init__(self, title=METADATA['name'])

        self.set_size_request(400, 250)
        self.connect('delete-event', self._exit_application)
        self.connect('destroy', self._exit_application)

        frame = Gtk.Box(
             orientation=Gtk.Orientation.VERTICAL, border_width=10, spacing=10)
        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.set_policy(
                            Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.liststore_worldclocks = Gtk.ListStore(str, str)

        #for item in SETTINGS.get_value('worldclocks'):
        for item in METADATA.get('worldclocks', []):
            self.liststore_worldclocks.append(item)

        self.treeview = Gtk.TreeView(model=self.liststore_worldclocks)

        # Labels column
        cellrenderertext = Gtk.CellRendererText()
        cellrenderertext.set_property('editable', True)
        cellrenderertext.connect('edited', self._on_label_edited)
        col = Gtk.TreeViewColumn('Display Name', cellrenderertext, text=0)
        col.set_property('resizable', True)
        col.set_expand(True)
        self.treeview.append_column(col)

        # Timezones column
        timezones = get_timezones()

        cellrendererautocomplete = CellRendererAutoComplete(
                              timezones, match_anywhere=True, force_match=True)
        cellrendererautocomplete.set_property('editable', True)
        cellrendererautocomplete.connect('edited', self._on_tz_edited)
        col = Gtk.TreeViewColumn('Timezone', cellrendererautocomplete, text=1)
        col.set_expand(True)
        self.treeview.append_column(col)

        # Allow enable drag and drop of rows including row move
        self.treeview.set_reorderable(True)

        scrolled_window.add(self.treeview)
        self.treeview.show()

        frame.pack_start(scrolled_window, True, True, 0)

        label = Gtk.Label(
                'Drag and Drop to re-order clocks.')
        frame.pack_start(label, False, False, 0)

        label = Gtk.Label(
                'Note: Cinnamon must be restarted for changes to take effect.')
        frame.pack_start(label, False, False, 0)

        # Buttons box
        box_buttons = Gtk.Box(
            orientation=Gtk.Orientation.HORIZONTAL, border_width=0, spacing=10)

        btn_new = Gtk.Button(stock=Gtk.STOCK_NEW)
        btn_new.connect('clicked', self._add_entry)
        box_buttons.pack_start(btn_new, False, False, 0)

        btn_remove = Gtk.Button(stock=Gtk.STOCK_REMOVE)
        btn_remove.connect('clicked', self._remove_entry)
        box_buttons.pack_start(btn_remove, False, False, 0)

        btn_close = Gtk.Button(stock=Gtk.STOCK_CLOSE)
        btn_close.connect('clicked', self._exit_application)
        box_buttons.pack_end(btn_close, False, False, 0)

        btn_clear = Gtk.Button(stock=Gtk.STOCK_CLEAR)
        btn_clear.connect('clicked', self._clear_entries)
        box_buttons.pack_end(btn_clear, False, False, 0)

        frame.pack_end(box_buttons, False, False, 0)

        frame.show_all()
        self.add(frame)
        self.show_all()

    def _on_label_edited(self, widget, path, new_value):
        self.liststore_worldclocks[path][0] = new_value
        return

    def _on_tz_edited(self, widget, path, new_value):
        self.liststore_worldclocks[path][1] = new_value
        return

    def _clear_entries(self, widget):
        self.liststore_worldclocks.clear()

    def _add_entry(self, widget):
        self.liststore_worldclocks.insert(
                      len(self.liststore_worldclocks), ('[]', 'Europe/London'))

    def _remove_entry(self, widget):
        self.liststore_worldclocks.remove(
                               self.treeview.get_selection().get_selected()[1])

    def _save_settings(self):
        #SETTINGS.set_value('worldclocks', GLib.Variant('a(ss)',
                          #[tuple(row) for row in self.liststore_worldclocks]))

        worldclocks = METADATA.get('worldclocks', [])
        worldclocks = [tuple(row) for row in self.liststore_worldclocks]
        METADATA['worldclocks'] = worldclocks
        metadata_path = os.path.join(APPLET_DIR, 'metadata.json')
        json.dump(METADATA, codecs.open(metadata_path, 'w', 'utf8'), indent=2)

    def _exit_application(self, *args):
        try:
            self._save_settings()
        except:
            pass
        Gtk.main_quit()


class CellRendererAutoComplete(Gtk.CellRendererText):

    """ Text entry cell which binds a Gtk.EntryCompletion object """

    __gtype_name__ = 'CellRendererAutoComplete'

    def __init__(
            self, completion_entries, match_anywhere=False, force_match=False):

        self.completion_entries = completion_entries
        self.force_match = force_match

        self._liststore = Gtk.ListStore(str)
        for item in self.completion_entries:
            self._liststore.append((item,))

        self.completion = Gtk.EntryCompletion()
        self.completion.set_model(self._liststore)
        self.completion.set_text_column(0)

        if match_anywhere:
            def completion_match_func(completion, key, path, userdata):
                return key in self._liststore[path][0].lower()
            self.completion.set_match_func(completion_match_func, 0)

        Gtk.CellRendererText.__init__(self)

    def do_start_editing(
               self, event, treeview, path, background_area, cell_area, flags):
        if not self.get_property('editable'):
            return
        saved_text = self.get_property('text')

        entry = Gtk.Entry()
        entry.set_completion(self.completion)
        entry.set_text(saved_text)
        #entry.connect('editing-done', self.editing_done, path)
        entry.connect('focus-out-event', self.focus_out, path)

        entry.show()
        entry.grab_focus()
        return entry

    def focus_out(self, entry, event, path):
        """ to ensure that changes are saved when the dialogue is closed with
            the widget still focussed, I'm emitting 'edited' on this even
            instead of 'editing-done'. The is probably not the correct way,
            but it works very nicely :) """
        new_value = entry.get_text()
        if self.force_match and new_value not in self.completion_entries:
            return
        self.emit('edited', path, new_value)


if __name__ == "__main__":

    # Initialize and load gsettings values
    #SETTINGS = get_settings(METADATA['settings-schema'])

    SettingsWindow()
    Gtk.main()
