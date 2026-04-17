/*
 * CrosshairCursor for X11 - Places a window shaped like crosshairs that follows your mouse cursor. 
 * Designed to run in Linux Mint Cinnamon but should work on other distributions.
 * A lot of the code was borrowed from oneko-sakura, and then modified to achieve my goal.
 * This code is given for free without any warranty whatsoever.
 * maintained at CrosshairCursor@BMarkley on Github
 */


//#include <X11/Xlib.h> 
//#include <X11/Xutil.h>
#include <X11/extensions/shape.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>

#define DEBUG_SOURCE 0
#define DEBUG_SOURCE_MORE 0
#define DEBUG_SOURCE_RESTORECURSOR 0


//#define	DEFAULT_BITMAP_WIDTH    4480*2
#define	DEFAULT_BITMAP_WIDTH	UNDEFINED
//#define	DEFAULT_BITMAP_HEIGHT	1080*2
#define	DEFAULT_BITMAP_HEIGHT	UNDEFINED
#define	DEFAULT_FOREGROUND	"lightgrey"	//centre of cursor
#define	DEFAULT_BACKGROUND	"black"	//outline of cursor	
#define	DEFAULT_INTERVAL	1000	//update interval in us	
#define	MAXDISPLAYNAME		(64 + 5)
#define	UNDEFINED		    (-1)
/*
 *	Global variables
 */

char *ClassName = "CrosshairCursor"; /* Command name */
char *ProgramName; /* Command name */

Display *theDisplay; /* Display structure */
int theScreen; /* Screen number */
unsigned int theDepth; /* Depth */
Window theRoot; /* Root window ID */
Window theWindow; /* Cat window ID */
char *WindowName = NULL; /* Cat window name */

unsigned int WindowWidth; /* Root window width */
unsigned int WindowHeight; /* Root window height */

XColor theForegroundColor; /* Foreground color */
XColor theBackgroundColor; /* Color (background) */

int Synchronous = False;

/*
* Various initial settings (can be changed using options and resources)
*/

/* options:	*/
int BitmapWidth = DEFAULT_BITMAP_WIDTH;
int BitmapHeight = DEFAULT_BITMAP_HEIGHT;
char *Foreground = DEFAULT_FOREGROUND;		/*   foreground	*/
char *Background = DEFAULT_BACKGROUND;		/*   background	*/
int noBG = 0; //no background
int fixedPosition = 0; //fixed position
useconds_t IntervalTime = DEFAULT_INTERVAL;	    /*   time in between updates	*/
int	ReverseVideo = UNDEFINED;	/*   reverse	*/
int XOffset=0,YOffset=0;        /* X and Y offsets for cat from mouse pointer. */
/*
* Various state variables
*/

Bool	DontMapped = True;

int MouseX; /* Mouse X coordinate */
int MouseY; /* Mouse Y coordinate */

int PrevMouseX = 0; /* Previous mouse X coordinate */
int PrevMouseY = 0; /* Previous mouse Y coordinate */

int NekoX; /* Cat X coordinate */
int NekoY; /* Cat Y coordinate */

int NekoMoveDx; /* Cat movement distance X */
int NekoMoveDy; /* Cat movement distance Y */

int NekoLastX; /* Last cat drawing X coordinate */
int NekoLastY; /* Last cat drawing Y coordinate */
GC NekoLastGC; /* Cat final drawing GC */

/* Variables used to set how quickly the program will chose to raise itself. */
/* Look at Interval(), Handle Visiblility Notify Event */
#define DEFAULT_RAISE_WAIT 16  /* About 2 seconds with default interval */
int     RaiseWindowDelay=0;
/*
*	others
*/

static void NullFunction();

/*
* Initialize bitmap data and GC
*/

void
InitGCs()
{
#if DEBUG_SOURCE
printf("Debug: InitGCs\n");
#endif
    XGCValues		theGCValues;

    theGCValues.function = GXcopy;
    theGCValues.foreground = theForegroundColor.pixel;
    theGCValues.background = theBackgroundColor.pixel;
    
    NekoLastGC = XCreateGC(theDisplay, theWindow,
        GCFunction | GCForeground | GCBackground,
        &theGCValues);    
}

/*
* Initialize the color
*/

int SetupColors()
{
#if DEBUG_SOURCE
printf("Debug: SetupColours\n");
#endif
    XColor	theExactColor;
    Colormap	theColormap;

    theColormap = DefaultColormap(theDisplay, theScreen);

    if (theDepth == 1) {
	Foreground = "black";
	Background = "white";
    }

    if (ReverseVideo == True) {
	char	*tmp;

	tmp = Foreground;
	Foreground = Background;
	Background = tmp;
    }

    if (!XAllocNamedColor(theDisplay, theColormap,
		Foreground, &theForegroundColor, &theExactColor)) {
            fprintf(stderr, "%s: Can't XAllocNamedColor(%s).\n",
            ProgramName, Foreground);
            exit(1);
    }

    if (!XAllocNamedColor(theDisplay, theColormap,
		Background, &theBackgroundColor, &theExactColor)) {
            fprintf(stderr, "%s: Can't XAllocNamedColor(%s).\n",
            ProgramName, Background);
            exit(1);
    }
}

/*
* Initialize the screen environment
*/

void
InitScreen(DisplayName)
    char	*DisplayName;
{
#if DEBUG_SOURCE
printf("Debug: InitScreen\n");
#endif
  XSetWindowAttributes	theWindowAttributes;
  unsigned long		    theWindowMask;
  Window			    theTempRoot;
  int				    WindowPointX;
  int				    WindowPointY;
  unsigned int		    BorderWidth;
  int				    event_base, error_base;

  if ((theDisplay = XOpenDisplay(DisplayName)) == NULL) {
    fprintf(stderr, "%s: Can't open display", ProgramName);
    if (DisplayName != NULL) {
      fprintf(stderr, " %s\n",DisplayName);
    } else {
      fprintf(stderr, "\n");
    }
    exit(1);
  }


  if (Synchronous == True) {
    fprintf(stderr,"Synchronizing\n");
    XSynchronize(theDisplay,True);
  }
  if (XShapeQueryExtension(theDisplay, &event_base, &error_base) == False) {
    fprintf(stderr, "Display not suported shape extension\n");
    } //terminate

  theScreen = DefaultScreen(theDisplay);
  theDepth = DefaultDepth(theDisplay, theScreen);
  theRoot = RootWindow(theDisplay, theScreen);
  XGetGeometry(theDisplay, theRoot, &theTempRoot,
	       &WindowPointX, &WindowPointY,
	       &WindowWidth, &WindowHeight,
	       &BorderWidth, &theDepth);
//    printf("WindowWidth: %d\nWindowHeight: %d\n",WindowWidth,WindowHeight);
    if (BitmapWidth == UNDEFINED || BitmapWidth > 2*WindowWidth + XOffset){
        BitmapWidth = 2*(WindowWidth + XOffset);
    }
    if (BitmapHeight == UNDEFINED || BitmapHeight > 2*WindowHeight + YOffset){
        BitmapHeight = 2*(WindowHeight + YOffset);
    }
  
  SetupColors();
  theWindowAttributes.background_pixel = theBackgroundColor.pixel;
  theWindowAttributes.override_redirect = True;

  theWindowMask = CWBackPixel|CWOverrideRedirect;

  theWindow = XCreateWindow(theDisplay, theRoot, 0, 0,
			    BitmapWidth, BitmapHeight,
			    0, theDepth, InputOutput, CopyFromParent,
			    theWindowMask, &theWindowAttributes);


  if (WindowName == NULL) WindowName = ProgramName;
  XStoreName(theDisplay, theWindow, WindowName);

  InitGCs();
  XSelectInput(theDisplay, theWindow, 
	       VisibilityChangeMask);
  XFlush(theDisplay);
}


/*
* SIGINT signal handling
*/

void
RestoreCursor()
{
#if DEBUG_SOURCE_RESTORECURSOR
printf("Debug: RestoreCursor\n");
#endif
//XUnmapWindow(theDisplay, theWindow);
//XDestroyWindow(theDisplay, theWindow);
//XFreeGC(theDisplay,NekoLastGC);
//XCloseDisplay(theDisplay); //there is a bug causing this to crash, so I skipped it.
  exit(0);
}


/*
* Interval
*
* When this function is called, it will not return for a certain period of time. Use this to adjust the timing of the cat's actions.
*/

void
Interval()
{
#if DEBUG_SOURCE_MORE
printf("Debug: Interval\n");
#endif
    if(0 != usleep(IntervalTime)){
        fprintf(stderr, "Error in Interval Sleep\n");
        exit(1);
        }
    if (RaiseWindowDelay>0) RaiseWindowDelay--;
}

/*
* Cat drawing process
*/

void
DrawNeko(x, y)
    int		x;
    int		y;
{
#if DEBUG_SOURCE
printf("Debug: DrawNeko\n");
#endif
/*@@@@@@*/
    if ((x != NekoLastX) || (y != NekoLastY)) {
      XMoveWindow(theDisplay, theWindow, x, y);
      if (DontMapped) {
	XMapWindow(theDisplay, theWindow);
	DontMapped = 0;
      }
    }
    
    //crosshairs
    //window shape (background)
    XRectangle xrectangles[2];
    xrectangles[0].height = BitmapHeight;
    xrectangles[0].width = 3;
    xrectangles[0].x = BitmapWidth/2-1;
    xrectangles[0].y = 0;
    xrectangles[1].height = 3;
    xrectangles[1].width = BitmapWidth;
    xrectangles[1].x = 0;
    xrectangles[1].y = BitmapHeight/2-1;
    if(!noBG){
    XShapeCombineRectangles(theDisplay, theWindow, ShapeBounding,
        0, 0, (XRectangle*)&xrectangles, 2, ShapeSet,0);
    }
    //foreground
    xrectangles[0].height = BitmapHeight;
    xrectangles[0].width = 1;
    xrectangles[0].x = BitmapWidth/2;
    xrectangles[0].y = 0;
    xrectangles[1].height = 1;
    xrectangles[1].width = BitmapWidth;
    xrectangles[1].x = 0;
    xrectangles[1].y = BitmapHeight/2;
    if(noBG){ //if no background colour
    XShapeCombineRectangles(theDisplay, theWindow, ShapeBounding,
        0, 0, (XRectangle*)&xrectangles, 2, ShapeSet,0);
    }  
    XFillRectangles(theDisplay, theWindow, NekoLastGC, (XRectangle*)&xrectangles, 2);
    
    XFlush(theDisplay);
    NekoLastX = x;
    NekoLastY = y;
    
}


/*
* Cat redraw process
*/

void
RedrawNeko(x, y)
    int		x;
    int		y;
    {
#if DEBUG_SOURCE_MORE
printf("Debug: RedrawNeko\n");
#endif
    if ((x != NekoLastX) || (y != NekoLastY)) {
//    XLowerWindow(theDisplay, theWindow);
    XMoveWindow(theDisplay, theWindow, x, y);
//    XRaiseWindow(theDisplay, theWindow);
    XFlush(theDisplay);
    //XSync(theDisplay, 0);
    NekoLastX = x;
    NekoLastY = y;
    }
}

/*
* Calculate cat movement dx, dy
*/

void
CalcDxDy()
{
#if DEBUG_SOURCE_MORE
printf("Debug: CalcDxDy\n");
#endif
    Window		QueryRoot, QueryChild;
    int			AbsoluteX, AbsoluteY;
    int			RelativeX, RelativeY;
    unsigned int	ModKeyMask;
    XQueryPointer(theDisplay, theWindow,
		   &QueryRoot, &QueryChild,
		   &AbsoluteX, &AbsoluteY,
		   &RelativeX, &RelativeY,
		   &ModKeyMask);
    PrevMouseX = MouseX;
    PrevMouseY = MouseY;
    if (0 == fixedPosition){
    MouseX = AbsoluteX+XOffset;
    MouseY = AbsoluteY+YOffset;
}
}


/*
* Motion analysis and cat drawing processing
*/

void
NekoThinkDraw()
{
#if DEBUG_SOURCE_MORE
printf("Debug: NekoThinkDraw\n");
#endif
    CalcDxDy();
	RedrawNeko(MouseX-BitmapWidth/2+3, MouseY-BitmapHeight/2+3);
    Interval(); //sleep
}


/*
* Event handling
*/

Bool
ProcessEvent()
{
#if DEBUG_SOURCE_MORE
printf("Debug: ProcessEvent\n");
#endif
    XEvent	theEvent;
    Bool	ContinueState = True;

    while (XPending(theDisplay)) {
        XNextEvent(theDisplay,&theEvent);
	switch (theEvent.type) {
	case VisibilityNotify:
	    if (RaiseWindowDelay==0) {
	      XRaiseWindow(theDisplay,theWindow);
	      RaiseWindowDelay=DEFAULT_RAISE_WAIT;
	    } 
	default:
	    /* Unknown Event */
	    break;
	}
    }
    return(ContinueState);
}


/*
* Cat disposal
*/

void
ProcessNeko(){
#if DEBUG_SOURCE
printf("Debug: ProcessNeko\n");
#endif
/* Initialize cat */
  NekoX = (WindowWidth - BitmapWidth / 2) / 2;
  NekoY = (WindowHeight - BitmapHeight / 2) / 2;
  NekoLastX = NekoX;
  NekoLastY = NekoY;
  
/* Main processing */
    CalcDxDy();
    DrawNeko(MouseX-BitmapWidth/2+3+XOffset, MouseY-BitmapHeight/2+3+YOffset);
  do {
    NekoThinkDraw();
  } while (ProcessEvent());
}


/*
* SIGALRM signal handling
*/

static void
NullFunction()
{
#if DEBUG_SOURCE
printf("Debug: NullFunction\n");
#endif
  /* No Operation */
#if defined(SYSV) || defined(SVR4)
  signal(SIGALRM, NullFunction);
#endif /* SYSV || SVR4 */
}

/*
* Error handling
*/

int
NekoErrorHandler(dpy, err)
     Display		*dpy;
     XErrorEvent	*err;
{
#if DEBUG_SOURCE
printf("Debug: NekoErrorHandler\n");
#endif
    char msg[80];
    XGetErrorText(dpy, err->error_code, msg, 80);
    fprintf(stderr, "%s: Error and exit\n%s\n",ProgramName, msg);
    exit(1);

}


/*
 *	Usage
 */

char	*message[] = {
"",
"Options are:",
"-h or -help                       : display this helpful message.",
"-fg <color>                       : foreground color.",
"-bg <color>                       : background/outline color.",
"-nobg                             : no-background.",
"-rv                               : invert colours.",
"-offset <geometry>                : set x and y offset ex: +2-12.",
"-position <geometry>              : set fixed x and y position. ex: 960x540.",
"-width                            : set the width of the cursor.",
"-height                           : set the height of the cursor.",
"-horizontal                       : horizontal Line only.",
"-vertical                         : vertical line only.",
"-time                             : time between updates in microseconds.",
"-display                          : name of display to draw window to.",
"-name                             : name of process.",
"-sync                             : puts you in synchronous mode.",
NULL };

void
Usage()
{
#if DEBUG_SOURCE
printf("Debug: Usage\n");
#endif
  char	**mptr;
  int loop;

  mptr = message;
  fprintf(stderr, "Usage: %s [<options>]\n",ProgramName);
  while (*mptr) {
    fprintf(stderr,"%s\n",*mptr);
    mptr++;
  }
}


/*
* Understanding options
*/

Bool
GetArguments(argc, argv, theDisplayName)
    int		argc;
    char	*argv[];
    char	*theDisplayName;
{
#if DEBUG_SOURCE
printf("Debug: GetArguments\n");
#endif
  int		ArgCounter;
  int    result,foo,bar;
  extern int XOffset,YOffset;
  int loop,found=0;

  theDisplayName[0] = '\0';

  for (ArgCounter = 0; ArgCounter < argc; ArgCounter++) {

    if ((strcmp(argv[ArgCounter], "-h") == 0) || (strcmp(argv[ArgCounter], "-help") == 0)) {
      Usage();
      exit(0);
    }
    if (strcmp(argv[ArgCounter], "-display") == 0) {
      ArgCounter++;
      if (ArgCounter < argc) {
	strcpy(theDisplayName, argv[ArgCounter]);
      } else {
	fprintf(stderr, "%s: -display option error\n",ProgramName);
	exit(1);
      }
    }
    else if (strcmp(argv[ArgCounter], "-time") == 0) {
      ArgCounter++;
      if (ArgCounter < argc) {
	IntervalTime = atol(argv[ArgCounter]);
      } else {
	fprintf(stderr, "%s: -time option error\n",ProgramName);
	exit(1);
      }
    }
    else if (strcmp(argv[ArgCounter], "-name") == 0) {
      ArgCounter++;
      if (ArgCounter < argc) {
	WindowName = argv[ArgCounter];
      } else {
	fprintf(stderr, "%s: -name option error.\n",ProgramName);
	exit(1);
      }
    }
    else if ((strcmp(argv[ArgCounter], "-fg") == 0) ||
	     (strcmp(argv[ArgCounter], "-foreground") == 0)) {
      ArgCounter++;
      Foreground = argv[ArgCounter];
	     }
    else if ((strcmp(argv[ArgCounter], "-bg") == 0) ||
	     (strcmp(argv[ArgCounter], "-background") == 0)) {
      ArgCounter++;
      Background = argv[ArgCounter];
	     }
    else if ((strcmp(argv[ArgCounter], "-nobg") == 0) ||
	     (strcmp(argv[ArgCounter], "-no-background") == 0)) {
      noBG = 1;
	     }
    else if (strcmp(argv[ArgCounter], "-rv") == 0) {
      ReverseVideo = True;
    }
    else if (strcmp(argv[ArgCounter], "-width") == 0) {
      ArgCounter++;
      if (ArgCounter < argc) {
        BitmapWidth = atof(argv[ArgCounter]);
      } else {
	fprintf(stderr, "%s: -width option error\n",ProgramName);
	exit(1);
      }
    }
    else if (strcmp(argv[ArgCounter], "-height") == 0) {
      ArgCounter++;
      if (ArgCounter < argc) {
        BitmapHeight = atof(argv[ArgCounter]);
      } else {
	fprintf(stderr, "%s: -height option error\n",ProgramName);
	exit(1);
      }
    }
    else if (strcmp(argv[ArgCounter], "-horizontal") == 0) {
        BitmapHeight = 3;
        if(1 == BitmapHeight && 1 == BitmapWidth){
          fprintf(stderr, "%s: -can't run 'only vertical' and 'only horizontal' at same time.\n",ProgramName);
          exit(1);
      }
    }
    else if (strcmp(argv[ArgCounter], "-vertical") == 0) {
        BitmapWidth = 3;
        if(1 == BitmapHeight && 1 == BitmapWidth){
          fprintf(stderr, "%s: -can't run 'only vertical' and 'only horizontal' at same time.\n",ProgramName);
          exit(1);
      }  
    }
    else if (strcmp(argv[ArgCounter], "-offset") == 0) {
      ArgCounter++;
      result=XParseGeometry(argv[ArgCounter],&XOffset,&YOffset,&foo,&bar);
      if ((0 == foo && 0 == bar)||(0 == XOffset && 0 == YOffset)){
        fprintf(stderr, "%s: -offset error\n",ProgramName);
        exit(1);
      }
    }
    else if (strcmp(argv[ArgCounter], "-position") == 0) {
      ArgCounter++;
      result=XParseGeometry(argv[ArgCounter],&foo,&bar,&MouseX,&MouseY);
      fixedPosition = 1;
      if (0 == MouseX && 0 == MouseY){
        fprintf(stderr, "%s: -position error\n",ProgramName);
        exit(1);
      }
    }
    else if (strcmp(argv[ArgCounter], "-sync") ==0) {
      Synchronous = True;
    }
    else {
      char *av = argv[ArgCounter] + 1;
      if (!found) {
	fprintf(stderr,
		"%s: Unknown option %s\n",ProgramName,
		argv[ArgCounter]);
	Usage();
	exit(1);
      }
    }
  }

  if (strlen(theDisplayName) < 1) {
    theDisplayName = NULL;
  }
}


/*
* Main function
*/

int
main(argc, argv)
    int		argc;
    char	*argv[];
{
#if DEBUG_SOURCE
printf("Debug: Main\n");
#endif
  char	theDisplayName[MAXDISPLAYNAME];

  ProgramName = argv[0];

  argc--;
  argv++;

  GetArguments(argc, argv, theDisplayName);
  XSetErrorHandler(NekoErrorHandler);
  InitScreen(theDisplayName);

  signal(SIGALRM, NullFunction);
  signal(SIGINT, RestoreCursor);
  signal(SIGTERM, RestoreCursor);
  signal(SIGQUIT, RestoreCursor);

  ProcessNeko();
  RestoreCursor();
}
