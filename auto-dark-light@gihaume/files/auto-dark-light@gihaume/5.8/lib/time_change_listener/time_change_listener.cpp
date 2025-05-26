#include "time_change_listener.hpp"

#include <sys/timerfd.h>
#include <unistd.h>

#include <cerrno>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <system_error>

namespace {

std::system_error system_error(const char* what) {
    return std::system_error{errno, std::system_category(), what};
}

// To inject instructions in the constructor's `fd` initializer
int new_timerfd() {
    int fd = ::timerfd_create(CLOCK_REALTIME, 0);
    if (fd == -1)
        throw system_error(
            "Time_change_listener::new_timer_fd: timerfd_create failed"
        );
    return fd;
}

} // namespace

Time_change_listener::Time_change_listener(std::function<void()> callback) :
    fd{new_timerfd()},
    callback{callback},
    listen_thread{&This::listen, this}
{}

void Time_change_listener::listen() const {
    do {
        static uint64_t dull_buffer;
        if (-1 == ::read(this->fd, &dull_buffer, sizeof(dull_buffer))) {
            if (errno == ECANCELED) { // system time changed
                this->callback();
                continue;
            } else {
                std::cerr << "Time_change_listener::listen: read failed: "
                          << std::strerror(errno) << std::endl;
                return;
            }
        }
    } while (!this->end_thread);
}

static constexpr struct itimerspec SETTIME_NEVER = {{0, 0}, {0, 0}};

void Time_change_listener::enable() const {
    static constexpr auto FLAGS =
        TFD_TIMER_ABSTIME | TFD_TIMER_CANCEL_ON_SET;
    if (-1 == ::timerfd_settime(this->fd, FLAGS, &SETTIME_NEVER, NULL))
        throw system_error(
            "Time_change_listener::enable: timerfd_settime failed"
        );
}

void Time_change_listener::disable() const {
    if (-1 == ::timerfd_settime(this->fd, 0, &SETTIME_NEVER, nullptr))
        throw system_error(
            "Time_change_listener::disable: timerfd_settime failed"
        );
}

Time_change_listener::~Time_change_listener() {
    this->end_thread = true;

    // Unblock the blocked `read` call in the `listen` method
    static constexpr struct itimerspec VIRTUALLY_NOW = {
        {0, 0},
        {0, 1} // expire once in 1 ns
    };
    if (-1 == ::timerfd_settime(this->fd, 0, &VIRTUALLY_NOW, nullptr))
        std::cerr << "Time_change_listener::~Time_change_listener: "
                     "timerfd_settime failed: "
                  << std::strerror(errno) << std::endl;

    if (-1 == ::close(this->fd))
        std::cerr << "Time_change_listener::~Time_change_listener: "
                     "close failed: " << std::strerror(errno) << std::endl;
}
