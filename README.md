World Clock Calendar
====================

UUID: calendar@simonwiles.net

A fork of the Cinnamon calendar applet with support for displaying multiple timezones.

Current Version: 1.1 (2014-12-18).

![World Clock Calendar Screenshot](https://raw.github.com/simonwiles/cinnamon_applets/master/calendar_screenshot.png "World Clock Calendar Screenshot")


Features:
---------
* Show one or more additional clocks for any timezone supported by the system.
* Settings dialogue to add/remove/edit/re-order clocks.
* Tool-tip shows the additional clocks.
* [Recently described as “super slick” by OMG! Ubuntu!](http://www.omgubuntu.co.uk/2014/12/add-time-zones-world-clock-ubuntu); thanks!

Notes:
------
* The times and dates will be formatted according to the system locale settings, specifically `LC_TIME` (as with the default Calendar applet).  If you wish to change this, you can use (e.g.) `sudo update-locale LC_TIME=zh_TW.UTF-8` (you will need to log out and in again for changes to take effect).

Version History:
----------------
* v1.2 (2015-08-26) -- update support for more environments, including multiple distinct instances of the applet.
* v1.1 (2014-12-18) -- first Cinnamon 2.4 compatible version.
* v1.0 (2013-08-28) -- rewrite to update to Cinnamon 2.0 support, and move to the Cinnamon 1.8+ settings api.
* v0.6 (2013-06-25) -- minor optimization.
* v0.5 (2013-06-23) -- Updated to use `GLib.DateTime` and `TimeZone` to handle the timezone conversion (credit to Maciej Katafiasz, a.k.a. [mathrick](https://github.com/mathrick)).
* v0.4 (2012-12-25) -- Updated to use `GSettings` (now updates automatically when the settings are changed, without the need to restart Cinnamon).
* v0.3 (2012-12-20) -- fix to work with older versions of `GLib` (e.g. on Fedora 17).  Thanks to [Pulsar](http://cinnamon-spices.linuxmint.com/users/view/1154).
* v0.2 (2012-12-12) -- Initial release.

Credits:
--------
* Clem and the Mint Team for the original calendar applet
* [mbokil](http://cinnamon-spices.linuxmint.com/users/view/354) for the idea and code to move the "Date and Time Settings" to a right-click menu.
* Maciej Katafiasz, a.k.a. [mathrick](https://github.com/mathrick) for the overdue update to `GLib` for the timezone handling.
* [gsmcmullin](https://github.com/gsmcmullin) for code updates