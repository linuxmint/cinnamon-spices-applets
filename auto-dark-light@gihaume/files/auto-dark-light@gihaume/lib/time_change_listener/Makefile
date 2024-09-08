BUILD_FOLDER   := build
SOURCE_FILES   := $(wildcard *.cpp)
OBJECT_FILES   := $(patsubst %.cpp, $(BUILD_FOLDER)/%.o, $(SOURCE_FILES))
EXECUTABLE     := time_change_listener
COMPILER       := g++
COMPILER_FLAGS := -std=c++20 -Wall -pedantic -Wextra
LINKER_FLAGS   :=


all: build


build: $(EXECUTABLE)

-include $(OBJECT_FILES:.o=.d)

$(EXECUTABLE): $(OBJECT_FILES)
	$(COMPILER) -o $@ $^ $(LINKER_FLAGS)

$(BUILD_FOLDER)/%.o: %.cpp
	@mkdir -p $(@D)
	$(COMPILER) -c $(COMPILER_FLAGS) -o $@ $< -MMD -MF $(@:.o=.d)


run: $(EXECUTABLE)
	./$(EXECUTABLE)


clean:
	$(RM) -rf $(BUILD_FOLDER)

.PHONY: all build run clean
