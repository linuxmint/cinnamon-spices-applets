#include "time_change_listener.hpp"

#include <iostream>
#include <string>
#include <vector>
#include <exception>

int main(int argc, char* argv[]) {
    std::vector<std::string> args{argv, argv + argc};

    if (std::find(args.begin(), args.end(), "--help") != args.end()) {
        std::cout << "Usage: " << args[0] << '\n'
                  << "Listens for system time changes and prints 'changed' to `stdout` each time it occurs.\n"
                  << '\n'
                  << "Commands via `stdin`:\n"
                  << "  'enable': Enable listening for the system time changes.\n"
                  << "  'disable': Disable listening for the system time changes.\n"
                  << "  'exit': Exit the program.\n"
                  << '\n'
                  << "Options:\n"
                  << "  --help: Display this help message.\n"
                  << std::endl;
        return 0;
    }

    try {
        Time_change_listener listener([]() {
            std::cout << "changed" << std::endl;
        });

        std::string input;
        while (std::getline(std::cin, input)) {
            if (input == "enable")
                listener.enable();
            else
            if (input == "disable")
                listener.disable();
            else
            if (input == "exit")
                break;
        }
    } catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        return 1;
    }
}
