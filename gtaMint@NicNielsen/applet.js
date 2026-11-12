// This Applet has 7 classic games, that I wrote using AI.
// Nic Nielsen - November 2026
// New Tecumseth, Ontario, Canada
// www.GreaterTecumsethArea.com

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const UUID = "gtaMint" + String.fromCharCode(64) + "NicNielsen";
const AppletDir = GLib.build_filenamev([
  GLib.get_home_dir(),
  ".local",
  "share",
  "cinnamon",
  "applets",
  UUID,
]);
if (imports.searchPath.indexOf(AppletDir) === -1)
  imports.searchPath.unshift(AppletDir);

const GameEngine = imports.gameEngine;
if (typeof _ === "undefined")
  var _ = function (s) {
    return s;
  };

function CarGameApplet(m, o, p, i) {
  this._init(m, o, p, i);
}
CarGameApplet.prototype = Object.create(Applet.IconApplet.prototype);
CarGameApplet.prototype.constructor = CarGameApplet;

CarGameApplet.prototype._init = function (
  metadata,
  orientation,
  panel_height,
  instance_id,
) {
  Applet.IconApplet.prototype._init.call(
    this,
    orientation,
    panel_height,
    instance_id,
  );
  this.metadata = metadata;
  this.uuid = metadata.uuid;
  this.instance_id = instance_id;
  this.W = 6;
  this.H = 12;
  this.OBS = ["🧑🏻‍🦽‍➡️", "💍", "💳", "🪙", "🔫", "💰"];
  this.SKULL = "☠️";
  this.CASH = "💵";
  this.WALL = "|";

  Object.assign(this, GameEngine.GamePrototype);

  this.sceneryCount = 0;
  this.pacmanTime = 0;
  this.timerId = null;
  this.pacmanWinState = false;

  this.goTurn = "black";
  this.goCaptures = {
    black: 0,
    white: 0,
  };
  this.aiMoving = false;

  // Smart navigation helper: Wraps around and skips stones until finding an empty spot
  this._findEmptySpotInDir = function (dx, dy) {
    let nx = this.cX;
    let ny = this.cY;
    for (let step = 0; step < 12; step++) {
      nx += dx;
      ny += dy;
      if (nx < 0) nx = 10;
      if (nx > 10) nx = 0;
      if (ny < 0) ny = 10;
      if (ny > 10) ny = 0;
      if (this.goGrid[ny][nx] === " ") {
        return { x: nx, y: ny };
      }
    }
    return null;
  };

  // Tetris Polyomino Definitions
  this.tetrisShapes = [
    [[1, 1, 1, 1]], // I
    [
      [1, 1, 1],
      [0, 1, 0],
    ], // T
    [
      [1, 1, 1],
      [1, 0, 0],
    ], // L
    [
      [1, 1, 1],
      [0, 0, 1],
    ], // J
    [
      [1, 1],
      [1, 1],
    ], // O
    [
      [1, 1, 0],
      [0, 1, 1],
    ], // Z
    [
      [0, 1, 1],
      [1, 1, 0],
    ], // S
  ];

  // Fully Expanded IQ Test Questions Pool
  this.masterIqQuestions = [
    {
      q: "Which number fits?\n2, 4, 8, 16, [ ? ]",
      a: "32",
      b: "24",
      c: "64",
      d: "20",
      ans: "a",
    },
    {
      q: "Which number fits?\n3, 5, 9, 17, [ ? ]",
      a: "25",
      b: "33",
      c: "21",
      d: "35",
      ans: "b",
    },
    {
      q: "Pattern: 1/6, 1/3, 1/2, 2/3, ...\nWhat comes next?",
      a: "5/6",
      b: "1",
      c: "7/6",
      d: "4/3",
      ans: "a",
    },
    {
      q: "Which number is 1/4 of 1/2\nof 1/5 of 200?",
      a: "2",
      b: "5",
      c: "10",
      d: "2.5",
      ans: "a",
    },
    {
      q: "Solve: 10 - 2 * 3 + 4 = [ ? ]",
      a: "28",
      b: "14",
      c: "12",
      d: "8",
      ans: "d",
    },
    {
      q: "What number is 3 more than the\nsquare root of 49?",
      a: "7",
      b: "10",
      c: "14",
      d: "52",
      ans: "b",
    },
    {
      q: "Look at series: 7, 10, 8, 11, 9, 12, ...\nWhat number comes next?",
      a: "7",
      b: "10",
      c: "13",
      d: "11",
      ans: "b",
    },
    {
      q: "Complete: 2, 3, 5, 7, 11, [ ? ]",
      a: "13",
      b: "12",
      c: "15",
      d: "17",
      ans: "a",
    },
    {
      q: "Complete the pattern:\n36, 34, 30, 28, 24, [ ? ]",
      a: "20",
      b: "22",
      c: "18",
      d: "23",
      ans: "b",
    },
    {
      q: "Complete the pattern:\n2, 6, 18, 54, [ ? ]",
      a: "108",
      b: "148",
      c: "162",
      d: "216",
      ans: "c",
    },
    {
      q: "Complete the pattern:\n1, 4, 9, 16, 25, [ ? ]",
      a: "36",
      b: "49",
      c: "30",
      d: "40",
      ans: "a",
    },
    {
      q: "Complete the pattern:\n80, 40, 20, 10, [ ? ]",
      a: "0",
      b: "2.5",
      c: "5",
      d: "1",
      ans: "c",
    },
    {
      q: "Complete the pattern:\n4, 7, 12, 19, 28, [ ? ]",
      a: "37",
      b: "39",
      c: "41",
      d: "43",
      ans: "b",
    },
    {
      q: "If 3x + 7 = 22, what is\nthe value of x?",
      a: "3",
      b: "4",
      c: "5",
      d: "6",
      ans: "c",
    },
    {
      q: "Insert the missing number:\n121, 100, 81, 64, [ ? ]",
      a: "50",
      b: "48",
      c: "49",
      d: "36",
      ans: "c",
    },
    {
      q: "Find the next number:\n1, 2, 4, 7, 11, 16, [ ? ]",
      a: "20",
      b: "22",
      c: "23",
      d: "24",
      ans: "b",
    },
    {
      q: "What is the value of\n5 + 5 * 5 - 5?",
      a: "20",
      b: "25",
      c: "45",
      d: "0",
      ans: "b",
    },
    {
      q: "Find the next number:\n10, 9, 11, 10, 12, 11, [ ? ]",
      a: "10",
      b: "12",
      c: "13",
      d: "14",
      ans: "c",
    },
    {
      q: "Complete the sequence:\n2, 5, 11, 23, [ ? ]",
      a: "47",
      b: "35",
      c: "46",
      d: "48",
      ans: "a",
    },
    {
      q: "What number is 15% of 200?",
      a: "15",
      b: "20",
      c: "30",
      d: "45",
      ans: "c",
    },
    {
      q: "Complete the pattern:\n100, 98, 95, 91, 86, [ ? ]",
      a: "82",
      b: "81",
      c: "80",
      d: "79",
      ans: "c",
    },
    {
      q: "If x/4 = 12, what is\n3x?",
      a: "36",
      b: "48",
      c: "144",
      d: "12",
      ans: "c",
    },
    {
      q: "Complete the sequence:\n0, 1, 3, 6, 10, 15, [ ? ]",
      a: "19",
      b: "20",
      c: "21",
      d: "22",
      ans: "c",
    },
    {
      q: "Find the missing number:\n3, 6, 12, 24, [ ? ], 96",
      a: "36",
      b: "48",
      c: "50",
      d: "72",
      ans: "b",
    },
    {
      q: "What is the next number?\n5, 11, 23, 47, [ ? ]",
      a: "95",
      b: "94",
      c: "96",
      d: "89",
      ans: "a",
    },
    {
      q: "Complete the sequence:\n1, 8, 27, 64, [ ? ]",
      a: "100",
      b: "125",
      c: "216",
      d: "81",
      ans: "b",
    },
    {
      q: "Book is to Reading as Fork is to:\n[ ? ]",
      a: "Drawing",
      b: "Eating",
      c: "Writing",
      d: "Spoon",
      ans: "b",
    },
    {
      q: "If a jacket costs $80 after a\n20% discount, original price was?",
      a: "$96",
      b: "$100",
      c: "$120",
      d: "$110",
      ans: "b",
    },
    {
      q: "Which word does NOT belong?",
      a: "Apple",
      b: "Banana",
      c: "Carrot",
      d: "Grape",
      ans: "c",
    },
    {
      q: "Solve: (12 / 3) * (18 - 14) = [ ? ]",
      a: "16",
      b: "8",
      c: "24",
      d: "12",
      ans: "a",
    },
  ];
  this.iqQuestions = [];
  this.currentIqIndex = 0;

  this.getBestPath = function () {
    let suffix = "classic";
    if (this.gameMode === "track") suffix = "track";
    else if (this.gameMode === "iqtest") suffix = "iq";
    else if (this.gameMode === "pacman") suffix = "pacman";
    else if (this.gameMode === "go") suffix = "go";
    else if (this.gameMode === "sudoku") suffix = "sudoku";
    else if (this.gameMode === "tetris") suffix = "tetris";
    return GLib.build_filenamev([
      GLib.get_user_config_dir(),
      "cinnamon-car-game-best-" + suffix + ".txt",
    ]);
  };

  this.loadBestScore = function () {
    try {
      let p = this.getBestPath();
      if (GLib.file_test(p, GLib.FileTest.EXISTS)) {
        let [ok, content] = GLib.file_get_contents(p);
        if (ok) {
          let val = parseFloat(content.toString().trim());
          if (!isNaN(val)) return val;
        }
      }
    } catch (e) {}
    return this.gameMode === "iqtest"
      ? 100
      : this.gameMode === "pacman"
        ? 9999
        : 0;
  };

  this.saveBestScore = function (val) {
    try {
      let p = this.getBestPath();
      GLib.file_set_contents(p, val.toString());
    } catch (e) {}
  };

  this.formatTime = function (seconds) {
    if (seconds >= 9999 || seconds < 0) return "--:--";
    let m = Math.floor(seconds / 60);
    let s = Math.floor(seconds % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  };

  this.initPacmanMap = function () {
    this.W = 15;
    this.H = 15;
    this.cX = 7;
    this.cY = 11;
    this.pacmanTime = 0;
    this.pacmanWinState = false;
    this.pacGrid = [
      [
        "╔",
        "═",
        "═",
        "═",
        "═",
        "═",
        "═",
        "╦",
        "═",
        "═",
        "═",
        "═",
        "═",
        "═",
        "╗",
      ],
      [
        "║",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "║",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "║",
      ],
      [
        "║",
        "·",
        "╔",
        "═",
        "·",
        "╦",
        "·",
        "║",
        "·",
        "╦",
        "·",
        "═",
        "╗",
        "·",
        "║",
      ],
      [
        "║",
        "·",
        "·",
        "·",
        "·",
        "║",
        "·",
        "·",
        "·",
        "║",
        "·",
        "·",
        "·",
        "·",
        "║",
      ],
      [
        "║",
        "═",
        "╗",
        "·",
        "═",
        "╩",
        "═",
        " ",
        "═",
        "╩",
        "═",
        "·",
        "╔",
        "═",
        "║",
      ],
      [
        "║",
        "·",
        "·",
        "·",
        "·",
        "·",
        "║",
        " ",
        "║",
        "·",
        "·",
        "·",
        "·",
        "·",
        "║",
      ],
      [
        "║",
        "·",
        "═",
        "═",
        "·",
        "·",
        "╚",
        "═",
        "╝",
        "·",
        "·",
        "═",
        "═",
        "·",
        "║",
      ],
      [
        " ",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        " ",
      ],
      [
        "║",
        "·",
        "═",
        "═",
        "·",
        "·",
        "╔",
        "═",
        "╗",
        "·",
        "·",
        "═",
        "═",
        "·",
        "║",
      ],
      [
        "║",
        "·",
        "·",
        "·",
        "·",
        "·",
        "║",
        " ",
        "║",
        "·",
        "·",
        "·",
        "·",
        "·",
        "║",
      ],
      [
        "║",
        "═",
        "╝",
        "·",
        "═",
        "╦",
        "═",
        " ",
        "═",
        "╦",
        "═",
        "·",
        "╚",
        "═",
        "║",
      ],
      [
        "║",
        "·",
        "·",
        "·",
        "·",
        "║",
        "·",
        "·",
        "·",
        "║",
        "·",
        "·",
        "·",
        "·",
        "║",
      ],
      [
        "║",
        "·",
        "╔",
        "═",
        "·",
        "╩",
        "·",
        "║",
        "·",
        "╩",
        "·",
        "═",
        "╗",
        "·",
        "║",
      ],
      [
        "║",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "║",
        "·",
        "·",
        "·",
        "·",
        "·",
        "·",
        "║",
      ],
      [
        "╚",
        "═",
        "═",
        "═",
        "═",
        "═",
        "═",
        "╩",
        "═",
        "═",
        "═",
        "═",
        "═",
        "═",
        "╝",
      ],
    ];
    this.ghosts = [
      { x: 6, y: 7, s: "😡" },
      { x: 8, y: 7, s: "🤢" },
    ];
  };

  this.initGoBoard = function () {
    this.W = 11;
    this.H = 11;
    this.cX = 5;
    this.cY = 5;
    this.goTurn = "black";
    this.aiMoving = false;
    this.goCaptures = { black: 0, white: 0 };
    this.goGrid = Array.from({ length: 11 }, () => Array(11).fill(" "));
  };

  // Math loop variant to shuffle out dynamic matrix Sudoku options
  this.initSudokuBoard = function () {
    this.W = 9;
    this.H = 9;
    this.cX = 4;
    this.cY = 4;

    let seedPattern = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];

    // Shift matching digit tokens randomly to randomize layout
    let numMap = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = numMap.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let temp = numMap[i];
      numMap[i] = numMap[j];
      numMap[j] = temp;
    }
    this.sudokuSolution = seedPattern.map((row) =>
      row.map((val) => numMap[val - 1]),
    );
    this.sudokuStartGrid = this.sudokuSolution.map((row) => [...row]);
    // Punch open 40 blank holes randomly to generate game layout
    let blankCount = 40;
    while (blankCount > 0) {
      let rx = Math.floor(Math.random() * 9);
      let ry = Math.floor(Math.random() * 9);
      if (this.sudokuStartGrid[ry][rx] !== 0) {
        this.sudokuStartGrid[ry][rx] = 0;
        blankCount--;
      }
    }
    this.sudokuGrid = this.sudokuStartGrid.map((row) => [...row]);
  };
  this.initTetrisBoard = function () {
    this.W = 10;
    this.H = 16;
    this.tetrisGrid = Array.from({ length: this.H }, () =>
      Array(this.W).fill("⬛"),
    );
    this.spawnTetrisPiece();
  };
  this.spawnTetrisPiece = function () {
    let randIdx = Math.floor(Math.random() * this.tetrisShapes.length);
    this.currentPiece = this.tetrisShapes[randIdx].map((row) => [...row]);
    this.pX = Math.floor((this.W - this.currentPiece[0].length) / 2);
    this.pY = 0;
    if (this.checkTetrisCollision(this.pX, this.pY, this.currentPiece)) {
      this.endGame();
    }
  };
  this.checkTetrisCollision = function (bx, by, piece) {
    for (let y = 0; y < piece.length; y++) {
      for (let x = 0; x < piece[y].length; x++) {
        if (piece[y][x]) {
          let ny = by + y;
          let nx = bx + x;
          if (nx < 0 || nx >= this.W || ny >= this.H) return true;
          if (ny >= 0 && this.tetrisGrid[ny][nx] !== "⬛") return true;
        }
      }
    }
    return false;
  };
  this.lockTetrisPiece = function () {
    let v = this["carChoice_" + this.gameMode] || "🧱";
    for (let y = 0; y < this.currentPiece.length; y++) {
      for (let x = 0; x < this.currentPiece[y].length; x++) {
        if (this.currentPiece[y][x]) {
          let ny = this.pY + y;
          if (ny >= 0 && ny < this.H) {
            this.tetrisGrid[ny][this.pX + x] = v;
          }
        }
      }
    }
    this.clearTetrisLines();
    this.spawnTetrisPiece();
  };
  this.clearTetrisLines = function () {
    let cleared = 0;
    for (let y = this.H - 1; y >= 0; y--) {
      if (this.tetrisGrid[y].every((cell) => cell !== "⬛")) {
        this.tetrisGrid.splice(y, 1);
        this.tetrisGrid.unshift(Array(this.W).fill("⬛"));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      this.score += cleared * 100;
      this.best = this.loadBestScore();
      if (this.score > this.best) {
        this.best = this.score;
        this.saveBestScore(this.best);
      }
    }
  };
  this.rotateTetrisPiece = function () {
    let rotated = Array.from({ length: this.currentPiece[0].length }, () =>
      Array(this.currentPiece.length).fill(0),
    );
    for (let y = 0; y < this.currentPiece.length; y++) {
      for (let x = 0; x < this.currentPiece[y].length; x++) {
        rotated[x][this.currentPiece.length - 1 - y] = this.currentPiece[y][x];
      }
    }
    if (!this.checkTetrisCollision(this.pX, this.pY, rotated)) {
      this.currentPiece = rotated;
    }
  };
  this.prepareQuizQuestions = function () {
    this.best = this.loadBestScore();
    if (this.gameMode === "pacman") {
      this.initPacmanMap();
      return;
    }
    if (this.gameMode === "go") {
      this.initGoBoard();
      return;
    }
    if (this.gameMode === "sudoku") {
      this.initSudokuBoard();
      return;
    }
    if (this.gameMode === "tetris") {
      this.initTetrisBoard();
      return;
    }
    this.score = this.gameMode === "iqtest" ? 100 : 0;
    this.currentIqIndex = 0;
    let pool = [...this.masterIqQuestions];
    for (let i = pool.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let temp = pool[i];
      pool[i] = pool[j];
      pool[j] = temp;
    }
    this.iqQuestions = pool.slice(0, 10);
  };
  this.handleIqAnswer = function (choice) {
    if (!this.run || this.go || this.gameMode !== "iqtest") return;
    let qItem = this.iqQuestions[this.currentIqIndex];
    if (qItem && choice === qItem.ans) {
      this.score += 10;
    } else {
      this.score -= 5;
    }
    this.currentIqIndex++;
    if (this.currentIqIndex >= this.iqQuestions.length) {
      this.best = this.loadBestScore();
      if (this.score > this.best) {
        this.best = this.score;
        this.saveBestScore(this.best);
      }
      if (typeof this.endGame === "function") this.endGame();
    } else {
      this.renderFrame();
    }
  };
  this.movePacman = function (dx, dy) {
    if (!this.run || this.go || this.gameMode !== "pacman") return;
    let nx = this.cX + dx,
      ny = this.cY + dy;
    if (nx < 0) nx = this.W - 1;
    if (nx >= this.W) nx = 0;
    if (ny < 0 || ny >= this.H) return;
    let cell = this.pacGrid[ny][nx];
    if (
      cell !== "═" &&
      cell !== "║" &&
      cell !== "╔" &&
      cell !== "╗" &&
      cell !== "╚" &&
      cell !== "╝" &&
      cell !== "╦" &&
      cell !== "╩"
    ) {
      this.cX = nx;
      this.cY = ny;
      if (cell === "·") this.pacGrid[ny][nx] = " ";
      this.checkPacmanCollisions();
      this.checkPacmanWin();
      this.renderFrame();
    }
  };
  this.checkPacmanCollisions = function () {
    for (let i = 0; i < this.ghosts.length; i++) {
      if (this.ghosts[i].x === this.cX && this.ghosts[i].y === this.cY) {
        this.pacmanWinState = false;
        this.endGame();
        return;
      }
    }
  };
  this.checkPacmanWin = function () {
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        if (this.pacGrid[y][x] === "·") return;
      }
    }
    this.pacmanWinState = true;
    this.best = this.loadBestScore();
    if (this.pacmanTime < this.best) {
      this.best = this.pacmanTime;
      this.saveBestScore(this.best);
    }
    this.score = this.pacmanTime;
    this.endGame();
  };
  this.placeGoStone = function (targetX, targetY) {
    if (!this.run || this.go || this.gameMode !== "go") return false;
    let tx = targetX !== undefined ? targetX : this.cX;
    let ty = targetY !== undefined ? targetY : this.cY;
    if (this.goGrid[ty][tx] !== " ") return false;
    let currentStone = this.goTurn === "black" ? "B" : "W";
    let opponentStone = this.goTurn === "black" ? "W" : "B";
    this.goGrid[ty][tx] = currentStone;
    let capturedAny = false;
    let visited = Array.from({ length: 11 }, () => Array(11).fill(false));
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 11; x++) {
        if (this.goGrid[y][x] === opponentStone && !visited[y][x]) {
          let group = [];
          let liberties = 0;
          this.floodFillGo(x, y, opponentStone, visited, group, () => {
            liberties++;
          });
          if (liberties === 0) {
            group.forEach((p) => {
              this.goGrid[p.y][p.x] = " ";
            });
            this.goCaptures[this.goTurn] += group.length;
            capturedAny = true;
          }
        }
      }
    }
    let selfVisited = Array.from({ length: 11 }, () => Array(11).fill(false));
    let selfGroup = [];
    let selfLiberties = 0;
    this.floodFillGo(tx, ty, currentStone, selfVisited, selfGroup, () => {
      selfLiberties++;
    });
    if (selfLiberties === 0 && !capturedAny) {
      this.goGrid[ty][tx] = " ";
      return false;
    }
    let foundNewSpot = false;
    for (let r = 1; r < 11 && !foundNewSpot; r++) {
      for (let dy = -r; dy <= r && !foundNewSpot; dy++) {
        for (let dx = -r; dx <= r && !foundNewSpot; dx++) {
          let nx = tx + dx;
          let ny = ty + dy;
          if (nx >= 0 && nx < 11 && ny >= 0 && ny < 11) {
            if (this.goGrid[ny][nx] === " ") {
              this.cX = nx;
              this.cY = ny;
              foundNewSpot = true;
            }
          }
        }
      }
    }
    this.goTurn = this.goTurn === "black" ? "white" : "black";
    let scoreTally = this.goCaptures.black;
    this.best = this.loadBestScore();
    if (scoreTally > this.best) {
      this.best = scoreTally;
      this.saveBestScore(this.best);
    }
    this.score = scoreTally;
    this.renderFrame();
    if (this.goTurn === "white" && !this.go) {
      this.aiMoving = true;
      this.renderFrame();
      imports.mainloop.timeout_add(400, () => {
        this.triggerGoComputerMove();
        return false;
      });
    }
    return true;
  };
  this.triggerGoComputerMove = function () {
    if (
      !this.run ||
      this.go ||
      this.gameMode !== "go" ||
      this.goTurn !== "white"
    ) {
      this.aiMoving = false;
      this.renderFrame();
      return;
    }
    let openIntersections = [];
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 11; x++) {
        if (this.goGrid[y][x] === " ") openIntersections.push({ x: x, y: y });
      }
    }
    if (openIntersections.length === 0) {
      this.goTurn = "black";
      this.aiMoving = false;
      this.renderFrame();
      return;
    }
    for (let i = 0; i < openIntersections.length; i++) {
      let pt = openIntersections[i];
      let mockGrid = this.goGrid.map((row) => [...row]);
      mockGrid[pt.y][pt.x] = "W";
      let oppVisited = Array.from({ length: 11 }, () => Array(11).fill(false));
      for (let y = 0; y < 11; y++) {
        for (let x = 0; x < 11; x++) {
          if (mockGrid[y][x] === "B" && !oppVisited[y][x]) {
            let grp = [];
            let libs = 0;
            this.floodFillGoMock(x, y, "B", mockGrid, oppVisited, grp, () => {
              libs++;
            });
            if (libs === 0) {
              this.goGrid[pt.y][pt.x] = "W";
              let visitedCascade = Array.from({ length: 11 }, () =>
                Array(11).fill(false),
              );
              let grpCascade = [];
              let libsCascade = 0;
              this.floodFillGo(x, y, "B", visitedCascade, grpCascade, () => {
                libsCascade++;
              });
              if (libsCascade === 0) {
                grpCascade.forEach((p) => {
                  this.goGrid[p.y][p.x] = " ";
                });
                this.goCaptures["white"] += grpCascade.length;
              }
              if (this.cX === pt.x && this.cY === pt.y) {
                let escapeSpot = this._findEmptySpotInDir(1, 0);
                if (escapeSpot) {
                  this.cX = escapeSpot.x;
                  this.cY = escapeSpot.y;
                }
              }
              this.goTurn = "black";
              this.aiMoving = false;
              this.renderFrame();
              return;
            }
          }
        }
      }
    }
    let adjacentMoves = [];
    openIntersections.forEach((pt) => {
      let closeToStone = false;
      let range = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      range.forEach((r) => {
        let nx = pt.x + r.x,
          ny = pt.y + r.y;
        if (nx >= 0 && nx < 11 && ny >= 0 && ny < 11) {
          if (this.goGrid[ny][nx] !== " ") closeToStone = true;
        }
      });
      if (closeToStone) adjacentMoves.push(pt);
    });
    let choicePool =
      adjacentMoves.length > 0 ? adjacentMoves : openIntersections;
    let finalMove = choicePool[Math.floor(Math.random() * choicePool.length)];
    this.goGrid[finalMove.y][finalMove.x] = "W";
    let postVisited = Array.from({ length: 11 }, () => Array(11).fill(false));
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 11; x++) {
        if (this.goGrid[y][x] === "B" && !postVisited[y][x]) {
          let grp = [];
          let libs = 0;
          this.floodFillGo(x, y, "B", postVisited, grp, () => {
            libs++;
          });
          if (libs === 0) {
            grp.forEach((p) => {
              this.goGrid[p.y][p.x] = " ";
            });
            this.goCaptures["white"] += grp.length;
          }
        }
      }
    }
    if (this.cX === finalMove.x && this.cY === finalMove.y) {
      let escapeSpot = this._findEmptySpotInDir(1, 0);
      if (escapeSpot) {
        this.cX = escapeSpot.x;
        this.cY = escapeSpot.y;
      }
    }
    this.goTurn = "black";
    this.aiMoving = false;
    this.renderFrame();
  };
  this.floodFillGoMock = function (
    sx,
    sy,
    stone,
    grid,
    visited,
    group,
    onLiberty,
  ) {
    let queue = [{ x: sx, y: sy }];
    visited[sy][sx] = true;
    let dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    while (queue.length > 0) {
      let curr = queue.shift();
      group.push(curr);
      dirs.forEach((d) => {
        let nx = curr.x + d.x,
          ny = curr.y + d.y;
        if (nx >= 0 && nx < 11 && ny >= 0 && ny < 11) {
          if (grid[ny][nx] === " ") onLiberty();
          else if (grid[ny][nx] === stone && !visited[ny][nx]) {
            visited[ny][nx] = true;
            queue.push({ x: nx, y: ny });
          }
        }
      });
    }
  };
  this.floodFillGo = function (sx, sy, stone, visited, group, onLiberty) {
    let queue = [{ x: sx, y: sy }];
    visited[sy][sx] = true;
    let dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    while (queue.length > 0) {
      let curr = queue.shift();
      group.push(curr);
      dirs.forEach((d) => {
        let nx = curr.x + d.x,
          ny = curr.y + d.y;
        if (nx >= 0 && nx < 11 && ny >= 0 && ny < 11) {
          if (this.goGrid[ny][nx] === " ") onLiberty();
          else if (this.goGrid[ny][nx] === stone && !visited[ny][nx]) {
            visited[ny][nx] = true;
            queue.push({ x: nx, y: ny });
          }
        }
      });
    }
  };

  this.checkSudokuWin = function (isAutoSolve) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (this.sudokuGrid[y][x] !== this.sudokuSolution[y][x]) return;
      }
    }
    this.score = 100;
    // Only trigger game-over state if the player solved it themselves
    if (!isAutoSolve) {
      this.endGame();
    }
  };

  this.solveSudokuPuzzle = function () {
    if (!this.run || this.go || this.gameMode !== "sudoku") return;
    this.sudokuGrid = this.sudokuSolution.map((row) => [...row]);
    // Pass true to signal this is an auto-solve and keep the board visible
    this.checkSudokuWin(true);
    this.renderFrame();
  };

  this.passGoTurn = function () {
    if (!this.run || this.go || this.gameMode !== "go" || this.aiMoving) return;
    this.goTurn = "white";
    this.lbl.set_text(
      "You Passed! Linus thinking... | Captures - B: " +
        this.goCaptures.black +
        " W: " +
        this.goCaptures.white +
        " | Record: " +
        this.best,
    );
    this.aiMoving = true;
    this.renderFrame();
    imports.mainloop.timeout_add(400, () => {
      this.triggerGoComputerMove();
      return false;
    });
  };
  this.loop = function () {
    if (!this.run || this.go) return false;
    if (
      this.gameMode === "go" ||
      this.gameMode === "iqtest" ||
      this.gameMode === "sudoku"
    )
      return false;
    if (this.gameMode === "tetris") {
      if (!this.checkTetrisCollision(this.pX, this.pY + 1, this.currentPiece)) {
        this.pY++;
      } else {
        this.lockTetrisPiece();
      }
      this.renderFrame();
      this.loopId = imports.mainloop.timeout_add(
        parseInt(this.baseSpeed) || 500,
        () => this.loop(),
      );
      return false;
    }
    if (this.gameMode === "pacman") {
      let dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      this.ghosts.forEach((g) => {
        let validMoves = [];
        dirs.forEach((d) => {
          let nx = g.x + d.x,
            ny = g.y + d.y;
          if (nx >= 0 && nx < this.W && ny >= 0 && ny < this.H) {
            let c = this.pacGrid[ny][nx];
            if (
              c !== "═" &&
              c !== "║" &&
              c !== "╔" &&
              c !== "╗" &&
              c !== "╚" &&
              c !== "╝" &&
              c !== "╦" &&
              c !== "╩"
            )
              validMoves.push({ x: nx, y: ny });
          }
        });
        if (validMoves.length > 0) {
          let move = validMoves[Math.floor(Math.random() * validMoves.length)];
          g.x = move.x;
          g.y = move.y;
        }
      });
      this.checkPacmanCollisions();
      this.renderFrame();
      this.loopId = imports.mainloop.timeout_add(300, () => this.loop());
      return false;
    }
    this.obs.forEach((o) => (o.y += 1));
    this.checkCollisions();
    if (this.go) return false;
    this.obs = this.obs.filter((o) => o.y < this.H);
    let diff = parseFloat(this.difficulty) || 0.3;
    if (this.roadblockCooldown === undefined) this.roadblockCooldown = 0;
    if (this.roadblockCooldown > 0) this.roadblockCooldown -= 1;
    if (this.gameMode === "track") {
      this.W = 10;
      if (this.bendDuration <= 0) {
        let r = Math.random();
        this.targetCenter =
          r < 0.25 ? 2.0 : r < 0.5 ? 4.0 : r < 0.75 ? 6.0 : 7.0;
        this.bendDuration = Math.floor(Math.random() * 4) + 2;
      }
      if (this.roadCenter === undefined) this.roadCenter = 4.5;
      if (this.targetCenter === undefined) this.targetCenter = 4.5;
      this.roadCenter += (this.targetCenter - this.roadCenter) * 0.3;
      this.bendDuration -= 1;
      let roundedCenter = Math.round(this.roadCenter);
      let leftBoundary = roundedCenter - 1,
        rightBoundary = roundedCenter + 1;
      for (let x = 0; x < this.W; x++) {
        if (x < leftBoundary || x > rightBoundary) {
          this.sceneryCount++;
          let asset = "🌴";
          if (this.sceneryCount % 50 === 0)
            asset = Math.random() < 0.5 ? "🦍" : "🦜";
          this.obs.push({ x: x, y: 0, s: asset, t: "scenery" });
        }
      }
      this.score += 1;
    } else {
      this.W = 6;
      if (this.cX >= this.W) this.cX = this.W - 1;
      if (Math.random() < diff * 1.1) {
        let r = Math.random();
        if (r < 0.25 && this.roadblockCooldown === 0) {
          let gapStart = Math.floor(Math.random() * (this.W - 1));
          for (let x = 0; x < this.W; x++) {
            if (x !== gapStart && x !== gapStart + 1)
              this.obs.push({ x: x, y: 0, s: "🚧", t: "wall" });
          }
          this.roadblockCooldown = 4;
        } else {
          let altRoll = Math.random();
          if (altRoll < 0.33) {
            this.obs.push({
              x: Math.floor(Math.random() * this.W),
              y: 0,
              s: this.SKULL,
              t: "hazard",
            });
          } else if (altRoll < 0.66) {
            this.obs.push({
              x: Math.floor(Math.random() * this.W),
              y: 0,
              s: this.CASH,
              t: "item",
            });
          } else {
            this.obs.push({
              x: Math.floor(Math.random() * this.W),
              y: 0,
              s: this.OBS[Math.floor(Math.random() * this.OBS.length)],
              t: "item",
            });
          }
        }
      }
    }
    this.renderFrame();
    this.loopId = imports.mainloop.timeout_add(
      parseInt(this.baseSpeed) || 250,
      () => this.loop(),
    );
    return false;
  };
  this.checkCollisions = function () {
    let hi = this.obs.findIndex((o) => o.y === this.cY && o.x === this.cX);
    if (hi !== -1) {
      let o = this.obs[hi];
      if (this.gameMode === "track") {
        if (o.t === "scenery") this.endGame();
      } else {
        if (o.s === this.SKULL || o.s === "🚧" || o.t === "wall")
          this.endGame();
        else {
          this.score += o.s === this.CASH ? 50 : 10;
          this.obs.splice(hi, 1);
        }
      }
    }
  };
  this.renderFrame = function () {
    // Toggle 'Solve Puzzle' button visibility so it only renders during Sudoku
    if (this.btnSolve) {
      if (this.gameMode === "sudoku" && this.run && !this.go) {
        this.btnSolve.show();
      } else {
        this.btnSolve.hide();
      }
    }

    let v = this["carChoice_" + this.gameMode] || "😂";
    this.best = this.loadBestScore();
    if (this.run && !this.go) {
      this.btnS.set_label("Quit Game");
    } else {
      this.btnS.set_label("Start");
    }
    if (this.go) {
      let isNewBest = false;
      if (this.gameMode === "pacman")
        isNewBest =
          this.pacmanWinState && this.score <= this.best && this.score > 0;
      else isNewBest = this.score >= this.best && this.score > 0;
      this.dialogTitle.set_text(
        isNewBest ? "🏆 NEW BEST! 🏆" : "☠️ Game Over! ☠️",
      );
      let scoreLabel =
        this.gameMode === "iqtest"
          ? "Final IQ: "
          : this.gameMode === "pacman"
            ? "Time: "
            : this.gameMode === "go"
              ? "Captures: "
              : "Final Score: ";
      let bestLabel =
        this.gameMode === "iqtest"
          ? "\nPersonal Best IQ: "
          : this.gameMode === "pacman"
            ? "\nPersonal Best Time: "
            : "\nPersonal Best: ";
      let displayScore =
        this.gameMode === "pacman" ? this.formatTime(this.score) : this.score;
      let displayBest =
        this.gameMode === "pacman" ? this.formatTime(this.best) : this.best;
      this.dialogScore.set_text(
        scoreLabel + displayScore + bestLabel + displayBest,
      );
      this.dialogOverlay.show();
      this.container.hide();
      if (this.timerId) {
        GLib.source_remove(this.timerId);
        this.timerId = null;
      }
      return;
    }
    this.dialogOverlay.hide();
    this.container.show();
    if (this.gameMode === "iqtest") {
      this.lbl.set_text("IQ: " + this.score + " | Best IQ: " + this.best);
    } else if (this.gameMode === "pacman") {
      this.lbl.set_text(
        "Time: " +
          this.formatTime(this.pacmanTime) +
          " | Best: " +
          this.formatTime(this.best),
      );
    } else if (this.gameMode === "go") {
      let statusText = this.aiMoving
        ? "Linus thinking...  "
        : "Your turn (Black)";
      this.lbl.set_text(
        "Go Mode | " +
          statusText +
          " | Captures - B: " +
          this.goCaptures.black +
          " W: " +
          this.goCaptures.white +
          " | Record: " +
          this.best,
      );
    } else if (this.gameMode === "sudoku") {
      this.lbl.set_text("Sudoku Mode | Press 'S' to Auto-Solve");
      if (this.scoreLbl)
        this.scoreLbl.set_text("Use keyboard 1-9 to input numbers");
    } else if (this.gameMode === "tetris") {
      this.lbl.set_text(
        "Tetris Mode | Score: " + this.score + " | Record: " + this.best,
      );
    } else {
      this.lbl.set_text("Score: " + this.score + " | Best: " + this.best);
    }
    if (this.gameMode === "iqtest") {
      if (!this.run) {
        let txt =
          "\n\n   🧠 IQ TEST GAME 🧠\n\n     • 10 Questions total\n     • Start IQ: 100\n     • Left Arrow  = A\n     • Up Arrow    = B\n     • Right Arrow = C\n     • Down Arrow  = D\n\n   Press space or Start!";
        this.area.set_text(txt);
        return;
      }
      let qItem = this.iqQuestions[this.currentIqIndex];
      if (!qItem) {
        if (typeof this.endGame === "function") this.endGame();
        return;
      }
      let txt =
        "Question " +
        (this.currentIqIndex + 1) +
        "/" +
        this.iqQuestions.length +
        "\n";
      txt += "--------------------------------------\n";
      txt += qItem.q + "\n\n";
      txt += " ⬅️ A) " + qItem.a + "\n";
      txt += " ⬆️ B) " + qItem.b + "\n";
      txt += " ➡️ C) " + qItem.c + "\n";
      txt += " ⬇️ D) " + qItem.d + "\n";
      this.area.set_text(txt);
      return;
    }
    if (this.gameMode === "pacman") {
      if (!this.run) {
        let txt =
          "\n\n   🕹️ PAC-MAN ARCADE 🕹️\n\n     • Drive your selected Emoji\n     • Collect all the dots (·)\n     • Avoid the 😡 and 🤢 ghosts\n     • Beat the record time!\n\n   Press space or Start!";
        this.area.set_text(txt);
        return;
      }
      let g = [];
      for (let y = 0; y < this.H; y++) g.push([...this.pacGrid[y]]);
      this.ghosts.forEach((gh) => {
        if (gh.y >= 0 && gh.y < this.H && gh.x >= 0 && gh.x < this.W)
          g[gh.y][gh.x] = gh.s;
      });
      g[this.cY][this.cX] = v;
      let displayRows = g.map((row) => {
        let rowStr = "";
        for (let x = 0; x < row.length; x++) {
          let cell = row[x];
          rowStr += cell;
          if (x < row.length - 1) {
            if (cell === "😡" || cell === "🤢" || cell === v) {
              continue;
            }
            rowStr += " ";
          }
        }
        return rowStr;
      });
      this.area.set_text(displayRows.join("\n"));
      return;
    }
    if (this.gameMode === "go") {
      if (!this.run) {
        let txt =
          "\n\n    ☯️ CHINESE GO (VS Linus) ☯️\n\n     • Arrows = Move cursor target\n     • Space/Start = Drop your stone (⚫)\n     • Computer (⚪) will counter automatically\n     • Fully encircle zones for captures!\n\n   Press space or Start!";
        this.area.set_text(txt);
        return;
      }
      let g = Array.from({ length: 11 }, () => Array(11).fill("·"));
      for (let y = 0; y < 11; y++) {
        for (let x = 0; x < 11; x++) {
          if (this.goGrid[y][x] === "B") g[y][x] = "⚫";
          if (this.goGrid[y][x] === "W") g[y][x] = "⚪";
        }
      }
      g[this.cY][this.cX] = "🎯";
      let displayRows = g.map((row) => {
        let rowStr = "";
        for (let x = 0; x < row.length; x++) {
          let cell = row[x];
          rowStr += cell;
          if (x < row.length - 1) {
            if (cell === "⚫" || cell === "⚪" || cell === "🎯") continue;
            rowStr += " ";
          }
        }
        return rowStr;
      });
      this.area.set_text(displayRows.join("\n"));
      return;
    }
    if (this.gameMode === "sudoku") {
      if (!this.run) {
        let txt =
          "\n\n    🧩 SUDOKU PUZZLE 🧩\n\n     • Arrows = Move selected tile cursor\n     • Number keys 1-9 = Fill out digit slots\n     • Backspace/0 = Wipe cell contents\n     • Click 'Solve Puzzle' or press 'S' to see answers!\n\n   Press space or Start!";
        this.area.set_text(txt);
        return;
      }
      let displayRows = [];
      for (let y = 0; y < 9; y++) {
        let rowStr = "";
        for (let x = 0; x < 9; x++) {
          let cellVal = this.sudokuGrid[y][x];
          let displayChar = cellVal === 0 ? "·" : cellVal.toString();
          let isCursor = x === this.cX && y === this.cY;
          if (isCursor) {
            rowStr += "[" + displayChar + "]";
          } else {
            rowStr += " " + displayChar + " ";
          }
          if (x === 2 || x === 5) rowStr += "│";
        }
        displayRows.push(rowStr);
        if (y === 2 || y === 5)
          displayRows.push("─────────┼─────────┼─────────");
      }
      this.area.set_text(displayRows.join("\n"));
      return;
    }
    if (this.gameMode === "tetris") {
      if (!this.run) {
        let txt =
          "\n\n    🧱 TETRIS BLOCK GAME 🧱\n\n     • Left/Right = Slide active block\n     • Up Arrow = Rotate block shape\n     • Down Arrow = Soft drop piece down\n     • Clear full rows for 100pts combo!\n\n   Press space or Start!";
        this.area.set_text(txt);
        return;
      }
      let g = this.tetrisGrid.map((row) => [...row]);
      for (let y = 0; y < this.currentPiece.length; y++) {
        for (let x = 0; x < this.currentPiece[y].length; x++) {
          if (this.currentPiece[y][x]) {
            let ny = this.pY + y;
            if (ny >= 0 && ny < this.H) {
              g[ny][this.pX + x] = v;
            }
          }
        }
      }
      this.area.set_text(g.map((row) => row.join(".")).join("\n"));
      return;
    }
    if (!this.run) {
      let m = this.score === 0 ? " · READY · " : "· PAUSED ·",
        t = Math.floor((this.H - 2) / 2),
        f = [];
      for (let i = 0; i < t; i++) f.push("      ");
      f.push(m);
      for (let i = 0; i < this.H - 2 - t; i++) f.push("      ");
      let r = Array(this.W).fill(" ");
      r[this.cX] = v;
      f.push(r.join(" "));
      this.area.set_text(f.join("\n"));
      return;
    }
    let g = Array.from({ length: this.H }, () => Array(this.W).fill(" "));
    this.obs.forEach((o) => {
      if (o.y < this.H) g[o.y][o.x] = o.s;
    });
    if (this.gameMode === "track") {
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          if (g[y][x] === " ") g[y][x] = "  ";
        }
      }
    }
    g[this.cY][this.cX] = v;
    this.area.set_text(g.map((r) => r.join(" ")).join("\n"));
  };
  this.set_applet_icon_path(AppletDir + "/icon.png");
  this.set_applet_tooltip("Click to play Cinnamon Games");
  this.menuManager = new PopupMenu.PopupMenuManager(this);
  this.menu = new Applet.AppletPopupMenu(this, orientation);
  this.menuManager.addMenu(this.menu);
  this.menu.actor.connect("key-press-event", (actor, event) => {
    let symbol = event.get_key_symbol();
    if (this.gameMode === "go" && this.aiMoving) return true;
    if (symbol === imports.gi.Clutter.KEY_Left) {
      if (this.gameMode === "iqtest") {
        this.handleIqAnswer("a");
      } else if (this.gameMode === "pacman") {
        this.movePacman(-1, 0);
      } else if (this.gameMode === "go") {
        let nextSpot = this._findEmptySpotInDir(-1, 0);
        if (nextSpot) {
          this.cX = nextSpot.x;
          this.cY = nextSpot.y;
        }
        this.renderFrame();
      } else if (this.gameMode === "sudoku") {
        if (this.cX > 0) this.cX--;
        this.renderFrame();
      } else if (this.gameMode === "tetris") {
        if (!this.checkTetrisCollision(this.pX - 1, this.pY, this.currentPiece))
          this.pX--;
        this.renderFrame();
      } else {
        this.move(-1, 0);
      }
      return true;
    }
    if (symbol === imports.gi.Clutter.KEY_Right) {
      if (this.gameMode === "iqtest") {
        this.handleIqAnswer("c");
      } else if (this.gameMode === "pacman") {
        this.movePacman(1, 0);
      } else if (this.gameMode === "go") {
        let nextSpot = this._findEmptySpotInDir(1, 0);
        if (nextSpot) {
          this.cX = nextSpot.x;
          this.cY = nextSpot.y;
        }
        this.renderFrame();
      } else if (this.gameMode === "sudoku") {
        if (this.cX < 8) this.cX++;
        this.renderFrame();
      } else if (this.gameMode === "tetris") {
        if (!this.checkTetrisCollision(this.pX + 1, this.pY, this.currentPiece))
          this.pX++;
        this.renderFrame();
      } else {
        this.move(1, 0);
      }
      return true;
    }
    if (symbol === imports.gi.Clutter.KEY_Up) {
      if (this.gameMode === "iqtest") {
        this.handleIqAnswer("b");
      } else if (this.gameMode === "pacman") {
        this.movePacman(0, -1);
      } else if (this.gameMode === "go") {
        let nextSpot = this._findEmptySpotInDir(0, -1);
        if (nextSpot) {
          this.cX = nextSpot.x;
          this.cY = nextSpot.y;
        }
        this.renderFrame();
      } else if (this.gameMode === "sudoku") {
        if (this.cY > 0) this.cY--;
        this.renderFrame();
      } else if (this.gameMode === "tetris") {
        this.rotateTetrisPiece();
        this.renderFrame();
      } else {
        this.move(0, -1);
      }
      return true;
    }
    if (symbol === imports.gi.Clutter.KEY_Down) {
      if (this.gameMode === "iqtest") {
        this.handleIqAnswer("d");
      } else if (this.gameMode === "pacman") {
        this.movePacman(0, 1);
      } else if (this.gameMode === "go") {
        let nextSpot = this._findEmptySpotInDir(0, 1);
        if (nextSpot) {
          this.cX = nextSpot.x;
          this.cY = nextSpot.y;
        }
        this.renderFrame();
      } else if (this.gameMode === "sudoku") {
        if (this.cY < 8) this.cY++;
        this.renderFrame();
      } else if (this.gameMode === "tetris") {
        if (!this.checkTetrisCollision(this.pX, this.pY + 1, this.currentPiece))
          this.pY++;
        this.renderFrame();
      } else {
        this.move(0, 1);
      }
      return true;
    }
    if (
      symbol === imports.gi.Clutter.KEY_s ||
      symbol === imports.gi.Clutter.KEY_S
    ) {
      if (this.gameMode === "sudoku" && this.run && !this.go) {
        this.solveSudokuPuzzle();
        return true;
      }
    }
    if (
      symbol === imports.gi.Clutter.KEY_p ||
      symbol === imports.gi.Clutter.KEY_P
    ) {
      if (this.gameMode === "go" && this.run && !this.go && !this.aiMoving) {
        this.passGoTurn();
        return true;
      }
    }
    if (symbol === imports.gi.Clutter.KEY_space) {
      if (this.gameMode === "go" && this.run && !this.go) {
        this.placeGoStone();
      } else {
        this.toggle();
      }
      return true;
    }
    if (this.gameMode === "sudoku" && this.run && !this.go) {
      let num = -1;
      if (
        symbol >= imports.gi.Clutter.KEY_1 &&
        symbol <= imports.gi.Clutter.KEY_9
      )
        num = symbol - imports.gi.Clutter.KEY_0;
      if (
        symbol === imports.gi.Clutter.KEY_0 ||
        symbol === imports.gi.Clutter.KEY_BackSpace
      )
        num = 0;
      if (num !== -1) {
        if (this.sudokuStartGrid[this.cY][this.cX] === 0) {
          this.sudokuGrid[this.cY][this.cX] = num;
          this.checkSudokuWin();
          this.renderFrame();
        }
        return true;
      }
    }
    return false;
  });
  this.contextMenu = new Applet.AppletContextMenu(this, orientation);
  let cItem = new PopupMenu.PopupMenuItem("Configure...");
  cItem.connect("activate", () =>
    GLib.spawn_command_line_async("cinnamon-settings applets " + this.uuid),
  );
  this.contextMenu.addMenuItem(cItem);
  this.resetGame();
  this.setupUI();
  this.settings = new Settings.AppletSettings(
    this,
    this.uuid,
    this.instance_id,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "gameMode",
    "gameMode",
    this._onModeSettingChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "difficulty",
    "uiDifficulty",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "speed",
    "speed",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "scale",
    "scale",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "carChoice_obstacles",
    "carChoice_obstacles",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "carChoice_track",
    "carChoice_track",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "carChoice_pacman",
    "carChoice_pacman",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "carChoice_go",
    "carChoice_go",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "carChoice_iqtest",
    "carChoice_iqtest",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "carChoice_sudoku",
    "carChoice_sudoku",
    this._onSettingsChanged.bind(this),
    null,
  );
  this.settings.bindProperty(
    Settings.BindingDirection.IN,
    "carChoice_tetris",
    "carChoice_tetris",
    this._onSettingsChanged.bind(this),
    null,
  );
  ["obstacles", "track", "pacman", "go", "iqtest", "sudoku", "tetris"].forEach(
    (m) => {
      this.settings.connect("setting-changed:carChoice_" + m, () =>
        this.renderFrame(),
      );
    },
  );
  this.settings.connect("setting-changed:speed", () => {
    this.updateDifficultySettings();
  });
  this.settings.connect("setting-changed:scale", () => {
    this.updateScaleSettings();
  });
  this.settings.connect("setting-changed:difficulty", () => {
    this.updateDifficultySettings();
    if (this.loopId) {
      imports.mainloop.source_remove(this.loopId);
      this.loopId = null;
    }
    this.resetGame();
    this.renderFrame();
  });
  this.updateDifficultySettings();
  this.updateScaleSettings();
  this.originalToggle = this.toggle;
  this.toggle = function () {
    if (this.gameMode === "pacman") {
      if (!this.run || this.go) {
        this.run = true;
        this.go = false;
        this.initPacmanMap();
        this.best = this.loadBestScore();
        this.pacmanTime = 0;
        if (this.timerId) {
          GLib.source_remove(this.timerId);
          this.timerId = null;
        }
        this.timerId = GLib.timeout_add_seconds(
          GLib.PRIORITY_DEFAULT,
          1,
          () => {
            if (this.run && !this.go) {
              this.pacmanTime++;
              this.renderFrame();
              return true;
            }
            this.timerId = null;
            return false;
          },
        );
        if (this.loopId) {
          imports.mainloop.source_remove(this.loopId);
          this.loopId = null;
        }
        this.loop();
      } else {
        this.run = false;
        if (this.timerId) {
          GLib.source_remove(this.timerId);
          this.timerId = null;
        }
      }
      this.renderFrame();
    } else if (this.gameMode === "go") {
      if (this.aiMoving) return;
      if (!this.run || this.go) {
        this.run = true;
        this.go = false;
        this.initGoBoard();
        this.best = this.loadBestScore();
      } else {
        this.run = false;
        this.initGoBoard();
      }
      this.renderFrame();
    } else if (this.gameMode === "sudoku") {
      if (!this.run || this.go) {
        this.run = true;
        this.go = false;
        this.initSudokuBoard();
        this.best = this.loadBestScore();
      } else {
        this.run = false;
        this.initSudokuBoard();
      }
      this.renderFrame();
    } else if (this.gameMode === "tetris") {
      if (!this.run || this.go) {
        this.run = true;
        this.go = false;
        this.initTetrisBoard();
        this.best = this.loadBestScore();
        if (this.loopId) {
          imports.mainloop.source_remove(this.loopId);
          this.loopId = null;
        }
        this.loop();
      } else {
        this.run = false;
      }
      this.renderFrame();
    } else {
      if (this.run && !this.go) {
        this.run = false;
        if (this.loopId) {
          this.loopId = null;
        }
        this.resetGame();
        this.renderFrame();
      } else {
        this.originalToggle();
      }
    }
  };
};
CarGameApplet.prototype.updateDifficultySettings = function () {
  let curDiff = this.uiDifficulty || "Normal",
    curSpeed = parseInt(this.speed) || 5,
    sm = 1.0,
    nds = "0.35";
  switch (curDiff) {
    case "Beginner":
      nds = "0.10";
      sm = 2.4;
      break;
    case "Easy":
      nds = "0.20";
      sm = 1.6;
      break;
    case "Normal":
      nds = "0.35";
      sm = 1.0;
      break;
    case "Hard":
      nds = "0.55";
      sm = 0.85;
      break;
    case "Professional":
      nds = "0.65";
      sm = 0.4;
      break;
  }
  let calcDelay = Math.round((600 - curSpeed * 50) * sm);
  if (calcDelay < 45) calcDelay = 45;
  this.difficulty = nds;
  this.baseSpeed = calcDelay;
};
CarGameApplet.prototype.updateScaleSettings = function () {
  this.deskletScale = parseFloat(this.scale) || 1.0;
  if (typeof this.applyUI === "function") this.applyUI();
};
CarGameApplet.prototype.setupUI = function () {
  this.win = new St.BoxLayout({ vertical: true });
  this.container = new St.BoxLayout({ vertical: true });
  this.headerBox = new St.BoxLayout({ vertical: false });
  this.lbl = new St.Label();
  this.scoreLbl = new St.Label();
  this.headerBox.add_actor(this.lbl);
  this.headerBox.add(new St.Widget({ x_expand: true }));
  this.headerBox.add_actor(this.scoreLbl);
  this.area = new St.Label();
  this.box = new St.BoxLayout({ vertical: false });
  this.btnS = new St.Button({ label: "Start" });
  this.btnS.connect("clicked", () => this.toggle());
  this.box.add_actor(this.btnS);
  // Dynamic Solution button initialization interface
  this.btnSolve = new St.Button({
    label: "Solve Puzzle",
    style_class: "popup-menu-item",
  });
  this.btnSolve.connect("clicked", () => {
    if (this.gameMode === "sudoku") this.solveSudokuPuzzle();
  });
  this.box.add_actor(this.btnSolve);
  this.container.add_actor(this.headerBox);
  this.container.add_actor(this.area);
  this.container.add_actor(this.box);
  this.dialogOverlay = new St.BoxLayout({ vertical: true });
  this.dialogTitle = new St.Label();
  this.dialogScore = new St.Label();
  this.dialogBtn = new St.Button({ label: "🔄 Play Again" });
  this.dialogBtn.connect("clicked", () => this.toggle());
  [this.dialogTitle, this.dialogScore, this.dialogBtn].forEach((a) =>
    this.dialogOverlay.add_actor(a),
  );
  this.win.add_actor(this.container);
  this.win.add_actor(this.dialogOverlay);
  this.menu.addActor(this.win);
};
CarGameApplet.prototype._onModeSettingChanged = function () {
  if (this.timerId) {
    GLib.source_remove(this.timerId);
    this.timerId = null;
  }
  if (this.loopId) {
    imports.mainloop.source_remove(this.loopId);
    this.loopId = null;
  }
  this.W =
    this.gameMode === "track"
      ? 10
      : this.gameMode === "pacman"
        ? 15
        : this.gameMode === "go"
          ? 11
          : this.gameMode === "sudoku"
            ? 9
            : this.gameMode === "tetris"
              ? 10
              : 6;
  this.H = this.gameMode === "tetris" ? 16 : 12;
  this.resetGame();
  this.renderFrame();
};
CarGameApplet.prototype.on_show_artwork_pressed = function () {
  if (typeof this.displayArtwork === "function") this.displayArtwork();
};
CarGameApplet.prototype.on_clear_high_score_pressed = function () {
  try {
    let defaultBest =
      this.gameMode === "pacman" ? 9999 : this.gameMode === "iqtest" ? 100 : 0;
    this.saveBestScore(defaultBest);
    this.best = defaultBest;
    this.score = this.gameMode === "iqtest" ? 100 : 0;
    this.renderFrame();
  } catch (e) {}
};
CarGameApplet.prototype.on_applet_clicked = function (e) {
  this.menu.toggle();
};
CarGameApplet.prototype._onSettingsChanged = function () {
  this.updateDifficultySettings();
  this.updateScaleSettings();
};
CarGameApplet.prototype.onAppletRemovedFromPanel = function () {
  if (this.loopId) imports.mainloop.source_remove(this.loopId);
  if (this.timerId) GLib.source_remove(this.timerId);
  this.settings.finalize();
};
function main(m, o, p, i) {
  return new CarGameApplet(m, o, p, i);
}
