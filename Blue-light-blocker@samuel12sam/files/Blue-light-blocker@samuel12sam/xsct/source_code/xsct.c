/*
 * xsct - X11 set color temperature
 *
 * Public domain, do as you wish.
 */

#include "xsct.h"

static void usage(const char *const pname)
{
    printf("Xsct (%s)\n"
           "Usage: %s [options] [temperature] [brightness]\n"
           "\tIf the argument is 0, xsct resets the display to the default temperature (6500K)\n"
           "\tIf no arguments are passed, xsct estimates the current display temperature and brightness\n"
           "Options:\n"
           "\t-h, --help \t xsct will display this usage information\n"
           "\t-v, --verbose \t xsct will display debugging information\n"
           "\t-d, --delta\t xsct will consider temperature and brightness parameters as relative shifts\n"
           "\t-s, --screen N\t xsct will only select screen specified by given zero-based index\n"
           "\t-t, --toggle \t xsct will toggle between 'day' and 'night' mode\n"
           "\t-c, --crtc N\t xsct will only select CRTC specified by given zero-based index\n", XSCT_VERSION, pname);
}

static double DoubleTrim(double x, double a, double b)
{
    const double buff[3] = {a, x, b};
    return buff[ (int)(x > a) + (int)(x > b) ];
}

static struct temp_status get_sct_for_screen(Display *dpy, int screen, int icrtc, int fdebug)
{
    Window root = RootWindow(dpy, screen);
    XRRScreenResources *res = XRRGetScreenResourcesCurrent(dpy, root);

    int n, c;
    double t = 0.0;
    double gammar = 0.0, gammag = 0.0, gammab = 0.0;
    struct temp_status temp;
    temp.temp = 0;

    n = res->ncrtc;
    if ((icrtc >= 0) && (icrtc < n))
        n = 1;
    else
        icrtc = 0;
    for (c = icrtc; c < (icrtc + n); c++)
    {
        RRCrtc crtcxid;
        int size;
        XRRCrtcGamma *crtc_gamma;
        crtcxid = res->crtcs[c];
        crtc_gamma = XRRGetCrtcGamma(dpy, crtcxid);
        size = crtc_gamma->size;
        gammar += crtc_gamma->red[size - 1];
        gammag += crtc_gamma->green[size - 1];
        gammab += crtc_gamma->blue[size - 1];

        XRRFreeGamma(crtc_gamma);
    }
    XFree(res);
    temp.brightness = (gammar > gammag) ? gammar : gammag;
    temp.brightness = (gammab > temp.brightness) ? gammab : temp.brightness;
    if (temp.brightness > 0.0 && n > 0)
    {
        gammar /= temp.brightness;
        gammag /= temp.brightness;
        gammab /= temp.brightness;
        temp.brightness /= n;
        temp.brightness /= BRIGHTHESS_DIV;
        temp.brightness = DoubleTrim(temp.brightness, 0.0, 1.0);
        if (fdebug > 0) fprintf(stderr, "DEBUG: Gamma: %f, %f, %f, brightness: %f\n", gammar, gammag, gammab, temp.brightness);
        const double gammad = gammab - gammar;
        if (gammad < 0.0)
        {
            if (gammab > 0.0)
            {
                t = exp((gammag + 1.0 + gammad - (GAMMA_K0GR + GAMMA_K0BR)) / (GAMMA_K1GR + GAMMA_K1BR)) + TEMPERATURE_ZERO;
            }
            else
            {
                t = (gammag > 0.0) ? (exp((gammag - GAMMA_K0GR) / GAMMA_K1GR) + TEMPERATURE_ZERO) : TEMPERATURE_ZERO;
            }
        }
        else
        {
            t = exp((gammag + 1.0 - gammad - (GAMMA_K0GB + GAMMA_K0RB)) / (GAMMA_K1GB + GAMMA_K1RB)) + (TEMPERATURE_NORM - TEMPERATURE_ZERO);
        }
    }
    else
        temp.brightness = DoubleTrim(temp.brightness, 0.0, 1.0);

    temp.temp = (int)(t + 0.5);

    return temp;
}

static void sct_for_screen(Display *dpy, int screen, int icrtc, struct temp_status temp, int fdebug)
{
    double t = 0.0, b = 1.0, gammar, gammag, gammab;
    int n, c;
    Window root = RootWindow(dpy, screen);
    XRRScreenResources *res = XRRGetScreenResourcesCurrent(dpy, root);

    t = (double)temp.temp;
    b = DoubleTrim(temp.brightness, 0.0, 1.0);
    if (temp.temp < TEMPERATURE_NORM)
    {
        gammar = 1.0;
        if (temp.temp > TEMPERATURE_ZERO)
        {
            const double g = log(t - TEMPERATURE_ZERO);
            gammag = DoubleTrim(GAMMA_K0GR + GAMMA_K1GR * g, 0.0, 1.0);
            gammab = DoubleTrim(GAMMA_K0BR + GAMMA_K1BR * g, 0.0, 1.0);
        }
        else
        {
            gammag = 0.0;
            gammab = 0.0;
        }
    }
    else
    {
        const double g = log(t - (TEMPERATURE_NORM - TEMPERATURE_ZERO));
        gammar = DoubleTrim(GAMMA_K0RB + GAMMA_K1RB * g, 0.0, 1.0);
        gammag = DoubleTrim(GAMMA_K0GB + GAMMA_K1GB * g, 0.0, 1.0);
        gammab = 1.0;
    }
    if (fdebug > 0) fprintf(stderr, "DEBUG: Gamma: %f, %f, %f, brightness: %f\n", gammar, gammag, gammab, b);
    n = res->ncrtc;
    if ((icrtc >= 0) && (icrtc < n))
        n = 1;
    else
        icrtc = 0;
    for (c = icrtc; c < (icrtc + n); c++)
    {
        int size, i;
        RRCrtc crtcxid;
        XRRCrtcGamma *crtc_gamma;
        crtcxid = res->crtcs[c];
        size = XRRGetCrtcGammaSize(dpy, crtcxid);

        crtc_gamma = XRRAllocGamma(size);

        for (i = 0; i < size; i++)
        {
            const double g = GAMMA_MULT * b * (double)i / (double)size;
            crtc_gamma->red[i] = (unsigned short int)(g * gammar + 0.5);
            crtc_gamma->green[i] = (unsigned short int)(g * gammag + 0.5);
            crtc_gamma->blue[i] = (unsigned short int)(g * gammab + 0.5);
        }

        XRRSetCrtcGamma(dpy, crtcxid, crtc_gamma);
        XRRFreeGamma(crtc_gamma);
    }

    XFree(res);
}

static void bound_temp(struct temp_status *const temp)
{
    if (temp->temp <= 0)
    {
        // identical behavior when xsct is called in absolute mode with temp == 0
        fprintf(stderr, "WARNING! Temperatures below %d cannot be displayed.\n", 0);
        temp->temp = TEMPERATURE_NORM;
    }
    else if (temp->temp < TEMPERATURE_ZERO)
    {
        fprintf(stderr, "WARNING! Temperatures below %d cannot be displayed.\n", TEMPERATURE_ZERO);
        temp->temp = TEMPERATURE_ZERO;
    }

    if (temp->brightness < 0.0)
    {
        fprintf(stderr, "WARNING! Brightness values below 0.0 cannot be displayed.\n");
        temp->brightness = 0.0;
    }
    else if (temp->brightness > 1.0)
    {
        fprintf(stderr, "WARNING! Brightness values above 1.0 cannot be displayed.\n");
        temp->brightness = 1.0;
    }
}

int main(int argc, char **argv)
{
    int i, screen, screens;
    int screen_specified, screen_first, screen_last, crtc_specified;
    struct temp_status temp;
    int fdebug = 0, fdelta = 0, fhelp = 0, toggle = 0;
    Display *dpy = XOpenDisplay(NULL);

    if (!dpy)
    {
        perror("XOpenDisplay(NULL) failed");
        fprintf(stderr, "ERROR! Ensure DISPLAY is set correctly!\n");
        return EXIT_FAILURE;
    }
    screens = XScreenCount(dpy);
    screen_first = 0;
    screen_last = screens - 1;
    screen_specified = -1;
    crtc_specified = -1;
    temp.temp = DELTA_MIN;
    temp.brightness = DELTA_MIN;
    for (i = 1; i < argc; i++)
    {
        if ((strcmp(argv[i],"-h") == 0) || (strcmp(argv[i],"--help") == 0)) fhelp = 1;
        else if ((strcmp(argv[i],"-v") == 0) || (strcmp(argv[i],"--verbose") == 0)) fdebug = 1;
        else if ((strcmp(argv[i],"-d") == 0) || (strcmp(argv[i],"--delta") == 0)) fdelta = 1;
        else if ((strcmp(argv[i],"-t") == 0) || (strcmp(argv[i],"--toggle") == 0)) toggle = 1;
        else if ((strcmp(argv[i],"-s") == 0) || (strcmp(argv[i],"--screen") == 0))
        {
            i++;
            if (i < argc)
            {
                screen_specified = atoi(argv[i]);
            } else {
                fprintf(stderr, "ERROR! Required value for screen not specified!\n");
                fhelp = 1;
            }
        }
        else if ((strcmp(argv[i],"-c") == 0) || (strcmp(argv[i],"--crtc") == 0))
        {
            i++;
            if (i < argc)
            {
                crtc_specified = atoi(argv[i]);
            } else {
                fprintf(stderr, "ERROR! Required value for crtc not specified!\n");
                fhelp = 1;
            }
        }
        else if (temp.temp == DELTA_MIN) temp.temp = atoi(argv[i]);
        else if (temp.brightness == DELTA_MIN) temp.brightness = atof(argv[i]);
        else
        {
            fprintf(stderr, "ERROR! Unknown parameter: %s\n!", argv[i]);
            fhelp = 1;
        }
    }

    if (fhelp > 0)
    {
        usage(argv[0]);
    }
    else if (screen_specified >= screens)
    {
        fprintf(stderr, "ERROR! Invalid screen index: %d!\n", screen_specified);
    }
    else
    {
        // Check if the temp is above 100 less than the norm and change to NIGHT if it is
        // The threashold was chosen to give some room for varients in temp
        if (toggle != 0)
        {
            for (screen = screen_first; screen <= screen_last; screen++)
            {
                temp = get_sct_for_screen(dpy, screen, crtc_specified, fdebug);
                if (temp.temp > (TEMPERATURE_NORM - 100))
                {
                    temp.temp = TEMPERATURE_NIGHT;
                }
                else
                {
                    temp.temp = TEMPERATURE_NORM;
                }
                sct_for_screen(dpy, screen, crtc_specified, temp, fdebug);
            }
        }
        if ((temp.brightness == DELTA_MIN) && (fdelta == 0)) temp.brightness = 1.0;
        if (screen_specified >= 0)
        {
            screen_first = screen_specified;
            screen_last = screen_specified;
        }
        if ((temp.temp == DELTA_MIN) && (fdelta == 0))
        {
            // No arguments, so print estimated temperature for each screen
            for (screen = screen_first; screen <= screen_last; screen++)
            {
                temp = get_sct_for_screen(dpy, screen, crtc_specified, fdebug);
                printf("Screen %d: temperature ~ %d %f\n", screen, temp.temp, temp.brightness);
            }
        }
        else
        {
            if (fdelta == 0)
            {
                // Set temperature to given value or default for a value of 0
                if (temp.temp == 0)
                {
                    temp.temp = TEMPERATURE_NORM;
                }
                else
                {
                    bound_temp(&temp);
                }             
                for (screen = screen_first; screen <= screen_last; screen++)
                {
                   sct_for_screen(dpy, screen, crtc_specified, temp, fdebug);
                }
            }
            else
            {
                // Delta mode: Shift temperature and optionally brightness of each screen by given value
                if (temp.temp == DELTA_MIN || temp.brightness == DELTA_MIN)
                {
                    fprintf(stderr, "ERROR! Temperature and brightness delta must both be specified!\n");
                }
                else
                {
                    for (screen = screen_first; screen <= screen_last; screen++)
                    {
                        struct temp_status tempd = get_sct_for_screen(dpy, screen, crtc_specified, fdebug);

                        tempd.temp += temp.temp;
                        tempd.brightness += temp.brightness;

                        bound_temp(&tempd);

                        sct_for_screen(dpy, screen, crtc_specified, tempd, fdebug);
                    }
                }
            }
        }
    }

    XCloseDisplay(dpy);

    return EXIT_SUCCESS;
}

