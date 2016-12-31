/*
 * myGtkMenu - read a description file and generate a menu.
 * Copyright (C) 2004-2007 John Vorthman
 * 
 * gimp_menu_position - Positions a #GtkMenu so that it pops up on screen.
 * Copyright (C) 1999-2003 Michael Natterer <mitch@gimp.org>
 * 
 * -------------------------------------------------------------------------
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License, version 2, as published
 * by the Free Software Foundation.
 * 
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 * 
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc., 59 
 * Temple Place, Suite 330, Boston, MA 02111-1307 USA
 * -------------------------------------------------------------------------
 * 
 * This program requires GTK+ 2.4 (or later) libraries.
 * 
 * main.c is used to generate myGtkMenu.
 *
 * gcc -Wall -o myGtkMenu main.c `pkg-config gtk+-2.0 --cflags --libs`
 * 
 */


#include <stdio.h>
#include <gtk/gtk.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <ctype.h>
#include <time.h>

#define MAX_LINE_LENGTH 200
#define MAX_MENU_ENTRIES 1000
#define MAX_SUBMENU_DEPTH 4
#define MAX_ICON_SIZE 200
#define MIN_ICON_SIZE 10

// Function prototypes
int ReadLine ();
static void RunItem (char *Cmd);
static void QuitMenu (char *Msg);
gboolean Get2Numbers (char *data);
void gimp_menu_position (GtkMenu * menu, gint * x, gint * y);
static void menu_position
	(GtkMenu * menu, gint * x, gint * y, gboolean * push_in, gpointer data);

// Global variables
char Line[MAX_LINE_LENGTH], data[MAX_LINE_LENGTH];
int depth, lineNum, menuX, menuY;
FILE *pFile;
GtkWidget *menu[MAX_SUBMENU_DEPTH];
char *HelpMsg = "myGtkMenu version 1.2.1, Copyright (C) 2004"
	"-2007 John Vorthman.\n"
	"Uses gimp_menu_position(), Copyright (C) 1999-2003\n"
	"Michael Natterer <mitch@gimp.org>.\n"
	"myGtkMenu comes with ABSOLUTELY NO WARRANTY - "
	"see license file.\n"
	"Purpose: read a description file and display a menu.\n"
	"Usage: myGtkMenu MenuDescriptionFilename\n"
	"menu.txt is an example input file.\n"
	"See menu.txt for help.\n\n";


// ----------------------------------------------------------------------
int main (int argc, char *argv[]) {
// ----------------------------------------------------------------------

	char *Filename;
	int Mode;		// What kind of input are we looking for?
	int Kind;		// Type of input actually read
	int curDepth;	// Root menu is depth = 0
	int curItem;	// Count number of menu entries
	gint w, h;		// Size of menu icon
	gboolean bSetMenuPos = FALSE;
	int i;
	char Item[MAX_LINE_LENGTH], Cmd[MAX_MENU_ENTRIES][MAX_LINE_LENGTH];
	GtkWidget *menuItem, *SubmenuItem = NULL;
	GtkWidget *image;
	GdkPixbuf *Pixbuf;
	GError *error = NULL;
	struct stat statbuf;

	if (!gtk_init_check (&argc, &argv)) {
		g_print("Error, cannot initialize gtk.\n");
		exit (EXIT_FAILURE);
	}
	
	if ((argc > 1) && (argv[1][0] == '-')) {
		g_print (HelpMsg);
		exit (EXIT_SUCCESS);
	}

	if (argc < 2) {
		g_print (HelpMsg);
		g_print ("Missing the menu-description filename.\n");
		g_print ("Will try to open the default file.\n");
		memset (data, 0, sizeof (data));
		strncpy (data, argv[0], sizeof (data) - 1);	// Get myGtkMenu path
		i = strlen (data);
		while ((i > 0) && (data[i] != '/'))
			data[i--] = '\0';	// Remove filename
		if ((i > 0) && (i < sizeof (data) - 14)) {
			strcat (data, "menu.txt");
			Filename = data;
		}
		else
			Filename = "menu.txt";
	}
	else
		Filename = (char *) argv[1];

	g_print ("Reading the file: %s\n", Filename);

	pFile = fopen (Filename, "r");
	if (pFile == NULL) {
		g_print ("Cannot open the file.\n");
		exit (EXIT_FAILURE);
	}

	menu[0] = gtk_menu_new ();
	if (!gtk_icon_size_lookup (GTK_ICON_SIZE_BUTTON, &w, &h)) {	// Default 
		w = 30;
		h = 30;
	};

	curItem = 0;
	Mode = 0;
	curDepth = 0;
	while ((Kind = ReadLine()) != 0) {	// Read next line and get 'Kind'
										// of keyword
		if (Kind == -1)
			Mode = -1;	// Error parsing file

		if (depth > curDepth) {
			g_print ("Keyword found at incorrect indentation.\n");
			Mode = -1;
		}
		else if (depth < curDepth) {	// Close submenu
			curDepth = depth;
		}

		if (Mode == 0) {	// Starting new sequence. Whats next?
			if (Kind == 1)
				Mode = 1;	// New item
			else if (Kind == 4)
				Mode = 4;	// New submenu
			else if (Kind == 5)
				Mode = 6;	// New separator
			else if (Kind == 6)
				Mode = 7;	// New icon size
			else if (Kind == 7)
				Mode = 8;	// Set menu position
			else {			// Problems
				g_print ("Keyword out of order.\n");
				Mode = -1;
			}
		}

		switch (Mode) {
		case 1:	// Starting new menu item
			if (curItem >= MAX_MENU_ENTRIES) {
				g_print ("Exceeded maximum number of menu items.\n");
				Mode = -1;
				break;
			}
			strcpy (Item, data);
			Mode = 2;
			break;
		case 2:	// Still making new menu item
			if (Kind != 2) {	// Problems if keyword 'cmd=' not found
				g_print ("Missing keyword 'cmd=' (after 'item=').\n");
				Mode = -1;
				break;
			}
			strcpy (Cmd[curItem], data);
			Mode = 3;
			break;
		case 3:	// Still making new menu item
			if (Kind != 3) {	// Problems if keyword 'icon=' not found
				g_print ("Missing keyword 'icon=' (after 'cmd=').\n");
				Mode = -1;
				break;
			}
			// Insert item into menu
			menuItem = gtk_image_menu_item_new_with_mnemonic (Item);
			gtk_menu_shell_append (GTK_MENU_SHELL (menu[curDepth]), menuItem);
			g_signal_connect_swapped (menuItem, "activate",
						  G_CALLBACK (RunItem), Cmd[curItem]);
			curItem++;
			Mode = 0;
			if (strncasecmp (data, "NULL", 4) == 0) break;	// No icon
			// If data is a dir name, program will hang.
			stat (data, &statbuf); 
			if (!S_ISREG (statbuf.st_mode)) {
				g_print ("Error at line # %d\n", lineNum);
				g_print ("Error, %s is not a icon file.\n",
					 data);
				break;
			}
			Pixbuf = gdk_pixbuf_new_from_file_at_size (data, w, h, &error);
			if (Pixbuf == NULL) {
				g_print ("Error at line # %d\n", lineNum);
				g_print ("%s\n", error->message);
				g_error_free (error);
				error = NULL;
			}
			image = gtk_image_new_from_pixbuf (Pixbuf);
			gtk_image_menu_item_set_image (GTK_IMAGE_MENU_ITEM
						       (menuItem), image);
			break;
		case 4:	// Start submenu
			if (curDepth >= MAX_SUBMENU_DEPTH) {
				g_print ("Maximum submenu depth exceeded.\n");
				Mode = -1;
				break;
			}
			SubmenuItem = gtk_image_menu_item_new_with_mnemonic (data);
			gtk_menu_shell_append(GTK_MENU_SHELL(menu[curDepth]), SubmenuItem);
			curDepth++;
			menu[curDepth] = gtk_menu_new ();
			gtk_menu_item_set_submenu (GTK_MENU_ITEM (SubmenuItem),
						   				menu[curDepth]);
			Mode = 5;
			break;
		case 5:	// Adding image to new submenu
			if (Kind != 3) {	// Problems if keyword 'icon=' not found
				g_print ("Missing keyword 'icon=' (after 'submenu=').\n");
				Mode = -1;
				break;
			}
			Mode = 0;
			if (strncasecmp (data, "NULL", 4) == 0) break;	// No icon
			// If data is a dir name, program will hang.
			stat (data, &statbuf);	
			if (!S_ISREG (statbuf.st_mode)) {
				g_print ("Error at line # %d\n", lineNum);
				g_print ("Error, %s is not a icon file.\n",
					 data);
				break;
			}
			Pixbuf = gdk_pixbuf_new_from_file_at_size (data, w, h, &error);
			if (Pixbuf == NULL) {
				g_print ("Error at line # %d\n", lineNum);
				g_print ("%s\n", error->message);
				g_error_free (error);
				error = NULL;
			}
			image = gtk_image_new_from_pixbuf (Pixbuf);
			gtk_image_menu_item_set_image (GTK_IMAGE_MENU_ITEM
						       (SubmenuItem), image);
			break;
		case 6:	// Insert separator into menu
			menuItem = gtk_separator_menu_item_new ();
			gtk_menu_shell_append (GTK_MENU_SHELL (menu[curDepth]), menuItem);
			Mode = 0;
			break;
		case 7:	// Change menu icon size
			i = atoi (data);
			if ((i < MIN_ICON_SIZE) || (i > MAX_ICON_SIZE)) {
				g_print ("Illegal size for menu icon.\n");
				Mode = -1;
				break;
			}
			w = i;
			h = i;
			g_print ("New icon size = %d.\n", w);
			Mode = 0;
			break;
		case 8:	// Set menu position
			if (Get2Numbers (data)) {
				bSetMenuPos = TRUE;
				g_print ("Menu position = %d, %d.\n", menuX, menuY);
				Mode = 0;
			}
			else {
				g_print ("Error reading menu position.\n");
				Mode = -1;
			}
			break;
		default:
			Mode = -1;
		}	// switch

		if (Mode == -1) {	// Error parsing file 
			// Placed here so that ReadLine is not called again
			g_print ("Error at line # %d\n", lineNum);
			g_print (">>>%s\n", Line);
			break;	// Quit reading file
		}
	}	// while

	fclose (pFile);

	gtk_widget_show_all (menu[0]);

	g_signal_connect_swapped (menu[0], "deactivate",
				  G_CALLBACK (QuitMenu), NULL);
	

	while(!GTK_WIDGET_VISIBLE(menu[0])) {	// Keep trying until startup 
		usleep(50000); 						// button (or key) is released
		if (bSetMenuPos)
				gtk_menu_popup (GTK_MENU (menu[0]), NULL, NULL,
				(GtkMenuPositionFunc) menu_position,
				NULL, 0, gtk_get_current_event_time ());
		else
				gtk_menu_popup (GTK_MENU (menu[0]), NULL, NULL, NULL, NULL, 0,
				gtk_get_current_event_time ());
		gtk_main_iteration();
        }

	gtk_main ();

	return 0;
	
}	// int main

// ----------------------------------------------------------------------
void menu_position (GtkMenu * menu, gint * x, gint * y, gboolean * push_in,
	 				gpointer data) {
// ----------------------------------------------------------------------
	*x = menuX;
	*y = menuY;
	*push_in = TRUE;
	gimp_menu_position (menu, x, y);	// Keep menu on the screen.
}	// void menu_position

// ----------------------------------------------------------------------
gboolean Get2Numbers (char *data) {
// ----------------------------------------------------------------------
	int n, i;

	n = strlen (data);
	if ((n == 0) | !isdigit (data[0]))
		return FALSE;
	menuX = atoi (data);
	i = 0;
	
	// Skip over first number
	while (isdigit (data[i])) {
		i++;
		if (i == n)
			return FALSE;
	}
	
	// Find start of the next number
	while (!isdigit (data[i])) {
		i++;
		if (i == n)	return FALSE;
	}
	
	menuY = atoi (&data[i]);
	return TRUE;
}	// gboolean Get2Numbers

// ----------------------------------------------------------------------
static void RunItem (char *Cmd) {
// ----------------------------------------------------------------------
	GdkScreen *screen = gtk_widget_get_screen (menu[0]);
	GError *error = NULL;

	g_print ("Run: %s\n", Cmd);

	if (!gdk_spawn_command_line_on_screen (screen, Cmd, &error)) {
		g_print ("Error running command.\n");
		g_print ("%s\n", error->message);
		g_error_free (error);
	}
	gtk_main_quit ();
}	// static void RunItem

// ----------------------------------------------------------------------
static void QuitMenu (char *Msg) {
// ----------------------------------------------------------------------
	g_print ("Menu was deactivated.\n");

	gtk_main_quit ();
}	// static void QuitMenu

// ----------------------------------------------------------------------
int ReadLine () {
// ----------------------------------------------------------------------
	// Return kind of line, menu depth, and stripped text
	// return(-1) = Error, return(0) = EOF, return(>0) = keyword
	char *chop;
	int i, len, count, Kind;
	char tmp[MAX_LINE_LENGTH];
	char *str1, *str2;

	len = 0;
	while (len == 0) {
		// Read one line.
		if (fgets (Line, MAX_LINE_LENGTH, pFile) == NULL)
			return (0);
		strcpy (tmp, Line);
		lineNum++;

		// Remove comments
		chop = strchr (tmp, '#');
		if (chop != 0)
			*chop = '\0';

		len = strlen (tmp);
		
		// Remove trailing spaces & CR
		if (len > 0) {
			chop = &tmp[len - 1];
			while ((chop >= tmp) && (isspace (*chop) != 0)) {
				*chop = '\0';
				chop--;
			}
			len = strlen (tmp);
		}
	};

	// Big error?
	if (len >= MAX_LINE_LENGTH) {
		strncpy (data, tmp, MAX_LINE_LENGTH);
		data[MAX_LINE_LENGTH] = '\0';
		return (-1);
	}

	count = 0;
	
	// Calculate menu depth
	for (i = 0; i < len; i++) {
		if (tmp[i] == ' ')
			count += 1;
		else if (tmp[i] == '\t')	// Tab character = 4 spaces
			count += 4;
		else
			break;
	};
	depth = count / 4;

	// Remove leading white space
	if (count > 0) {
		str1 = tmp;
		str2 = tmp;
		while ((*str2 == ' ') || (*str2 == '\t')) {
			str2++;
			len--;
		}
		for (i = 0; i <= len; i++)
			*str1++ = *str2++;
	}

	if (strncasecmp (tmp, "separator", 9) == 0) {		// Found 'separator'
		strcpy (data, tmp);
		return (5);
	}
	else if (strchr (tmp, '=') == NULL)	{ 				// Its a bad line
		strcpy (data, tmp);
		return (-1);
	}
	else if (strncasecmp (tmp, "iconsize", 8) == 0) {	// Found 'iconsize'
		Kind = 6;
	}
	else if (strncasecmp (tmp, "item", 4) == 0)	{ 		// Found 'item'
		Kind = 1;
	}
	else if (strncasecmp (tmp, "cmd", 3) == 0) {		// Found 'cmd'
		Kind = 2;
	}
	else if (strncasecmp (tmp, "icon", 4) == 0) {		// Found 'icon'
		Kind = 3;
	}
	else if (strncasecmp (tmp, "submenu", 7) == 0) {	// Found 'submenu'
		Kind = 4;
	}
	else if (strncasecmp (tmp, "menupos", 7) == 0) {	// Found 'menupos'
		Kind = 7;
	}
	else {												// Its a bad line
		strcpy (data, tmp);
		return (-1);
	}

	// Remove keywords and white space 
	str2 = strchr (tmp, '=') + 1;
	while ((*str2 == ' ') || (*str2 == '\t'))
		str2++;
	strcpy (data, str2);


	return (Kind);
}	// int ReadLine

// =====================================================================
// =====================================================================

/* The GIMP -- an image manipulation program
 * Copyright (C) 1995 Spencer Kimball and Peter Mattis
 *
 * gimpwidgets-utils.c
 * Copyright (C) 1999-2003 Michael Natterer <mitch@gimp.org>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 */


/**
 * gimp_menu_position:
 * @menu: a #GtkMenu widget
 * @x: pointer to horizontal position
 * @y: pointer to vertical position
 *
 * Positions a #GtkMenu so that it pops up on screen.  This function
 * takes care of the preferred popup direction (taken from the widget
 * render direction) and it handles multiple monitors representing a
 * single #GdkScreen (Xinerama).
 *
 * You should call this function with @x and @y initialized to the
 * origin of the menu. This is typically the center of the widget the
 * menu is popped up from. gimp_menu_position() will then decide if
 * and how these initial values need to be changed.
 **/
void
gimp_menu_position (GtkMenu *menu,
		    gint    *x,
		    gint    *y)
{
  GtkWidget      *widget;
  GdkScreen      *screen;
  GtkRequisition  requisition;
  GdkRectangle    rect;
  gint            monitor;

//  g_return_if_fail (GTK_IS_MENU (menu));
//  g_return_if_fail (x != NULL);
//  g_return_if_fail (y != NULL);

  widget = GTK_WIDGET (menu);

  screen = gtk_widget_get_screen (widget);

  monitor = gdk_screen_get_monitor_at_point (screen, *x, *y);
  gdk_screen_get_monitor_geometry (screen, monitor, &rect);

  gtk_menu_set_screen (menu, screen);

  gtk_widget_size_request (widget, &requisition);

  if (gtk_widget_get_direction (widget) == GTK_TEXT_DIR_RTL)
    {
      *x -= requisition.width;
      if (*x < rect.x)
        *x += requisition.width;
    }
  else
    {
      if (*x + requisition.width > rect.x + rect.width)
        *x -= requisition.width;
    }

  if (*x < rect.x)
    *x = rect.x;

  if (*y + requisition.height > rect.y + rect.height)
    *y -= requisition.height;

  if (*y < rect.y)
    *y = rect.y;
}
