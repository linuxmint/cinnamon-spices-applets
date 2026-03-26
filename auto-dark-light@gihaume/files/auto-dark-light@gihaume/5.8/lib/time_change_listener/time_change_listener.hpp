#pragma once

#include <atomic>
#include <functional>
#include <thread>

/**
 * @brief A passive listener for system time changes implementing the kernel's
 * `TFD_TIMER_CANCEL_ON_SET` flag feature.
 */
class Time_change_listener {
    using This = Time_change_listener;

    // Owned ressource (mustn't be copied)
    Time_change_listener(const This&) = delete;
    This& operator=(const This&) = delete;

  public:
    /**
     * @param callback The function to be called to notify when the system time
     * changes.
     * @throw `std::system_error` if the internal timer file descriptor failed
     * to be created due to any operating system restriction.
     */
    Time_change_listener(std::function<void()> callback);

    /**
     * @brief Enable listening for the system time changes.
     */
    void enable() const;

    /**
     * @brief Disable listening for the system time changes.
     */
    void disable() const;

    ~Time_change_listener();

  private:
    const int fd; // Linux file descriptor
    const std::function<void()> callback;
    const std::jthread listen_thread;
    std::atomic_bool end_thread = false;

    void listen() const;
};
