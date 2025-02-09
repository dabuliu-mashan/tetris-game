class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.blockSize = 30;
        this.cols = 10;
        this.rows = 20;
        this.maxScore = 999999;
        this.maxLevel = 99;
        
        // 设置画布大小
        this.canvas.width = this.blockSize * this.cols;
        this.canvas.height = this.blockSize * this.rows;
        
        // 游戏状态
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.isPaused = false;
        
        // 方块形状定义
        this.shapes = [
            [[1, 1, 1, 1]], // I
            [[1, 1], [1, 1]], // O
            [[0, 1, 0], [1, 1, 1]], // T
            [[1, 0, 0], [1, 1, 1]], // L
            [[0, 0, 1], [1, 1, 1]], // J
            [[0, 1, 1], [1, 1, 0]], // S
            [[1, 1, 0], [0, 1, 1]]  // Z
        ];
        
        // 方块颜色
        this.colors = [
            '#FF0D72', '#0DC2FF', '#0DFF72',
            '#F538FF', '#FF8E0D', '#FFE138',
            '#3877FF'
        ];
        
        // 游戏区域矩阵
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        
        // 当前方块
        this.currentShape = null;
        this.currentColor = null;
        this.currentX = 0;
        this.currentY = 0;
        
        // 下一个方块
        this.nextShape = null;
        this.nextColor = null;
        
        // 修改下落速度相关参数
        this.dropInterval = 1000;
        this.minDropInterval = 200;
        this.lastDrop = 0;
        
        // 添加排行榜相关
        this.leaderboard = this.loadLeaderboard();
        
        // 添加连击计数
        this.combo = 0;
        
        // 绑定事件处理
        this.bindEvents();
    }
    
    bindEvents() {
        // 键盘控制
        document.addEventListener('keydown', this.handleKeyPress.bind(this));
        
        // 移动端按钮控制
        const moveInterval = 120; // 调整移动间隔时间
        const touchThreshold = 60; // 减少触摸事件的最小间隔时间
        
        // 触摸状态管理
        const touchState = {
            lastTouchTime: 0,
            lastMoveTime: 0,
            isPressed: false,
            activeIntervals: new Set()
        };
        
        const clearAllIntervals = () => {
            touchState.activeIntervals.forEach(interval => clearInterval(interval));
            touchState.activeIntervals.clear();
            touchState.isPressed = false;
        };
        
        const handleTouch = (action) => {
            const now = Date.now();
            if (now - touchState.lastTouchTime < touchThreshold) return;
            touchState.lastTouchTime = now;
            
            switch(action) {
                case 'left':
                    if (this.moveShape(-1)) {
                        soundManager.play('move');
                    }
                    break;
                case 'right':
                    if (this.moveShape(1)) {
                        soundManager.play('move');
                    }
                    break;
                case 'down':
                    if (this.dropShape()) {
                        soundManager.play('move');
                    }
                    break;
                case 'rotate':
                    if (this.rotateShape()) {
                        soundManager.play('rotate');
                    }
                    break;
            }
        };
        
        // 触摸事件处理
        const addTouchHandlers = (element, action) => {
            const startHandler = (e) => {
                e.preventDefault();
                touchState.isPressed = true;
                handleTouch(action);
                
                if (action !== 'rotate') {
                    const interval = setInterval(() => {
                        if (touchState.isPressed) {
                            handleTouch(action);
                        }
                    }, moveInterval);
                    touchState.activeIntervals.add(interval);
                }
            };
            
            const endHandler = () => {
                clearAllIntervals();
            };
            
            // 添加触摸事件监听器
            element.addEventListener('touchstart', startHandler, { passive: false });
            element.addEventListener('touchend', endHandler);
            element.addEventListener('touchcancel', endHandler);
            
            // 添加鼠标事件监听器（用于开发调试）
            if (!('ontouchstart' in window)) {
                element.addEventListener('mousedown', startHandler);
                element.addEventListener('mouseup', endHandler);
                element.addEventListener('mouseleave', endHandler);
            }
        };

        // 为所有按钮添加触摸处理
        addTouchHandlers(document.getElementById('leftBtn'), 'left');
        addTouchHandlers(document.getElementById('rightBtn'), 'right');
        addTouchHandlers(document.getElementById('dropBtn'), 'down');
        addTouchHandlers(document.getElementById('rotateBtn'), 'rotate');
        
        // 声音按钮点击效果
        const soundBtn = document.getElementById('soundBtn');
        const handleSoundClick = () => {
            const isMuted = soundManager.toggleMute();
            soundBtn.classList.toggle('active', !isMuted);
            if (!isMuted) {
                soundManager.play('button');
            }
        };
        
        if ('ontouchstart' in window) {
            soundBtn.addEventListener('touchstart', handleSoundClick);
        } else {
            soundBtn.addEventListener('click', handleSoundClick);
        }
        
        // 添加按钮音效
        ['restartBtn', 'rankBtn', 'closeRankBtn', 'saveScoreBtn'].forEach(btnId => {
            const btn = document.getElementById(btnId);
            const handler = () => soundManager.play('button');
            
            if ('ontouchstart' in window) {
                btn.addEventListener('touchstart', handler);
            } else {
                btn.addEventListener('click', handler);
            }
        });
    }
    
    handleKeyPress(event) {
        if (this.gameOver) return;
        
        switch(event.keyCode) {
            case 37: // 左箭头
                this.moveShape(-1);
                break;
            case 39: // 右箭头
                this.moveShape(1);
                break;
            case 40: // 下箭头
                this.dropShape();
                break;
            case 38: // 上箭头
                this.rotateShape();
                break;
        }
    }
    
    createNewShape() {
        if (this.nextShape === null) {
            const index = Math.floor(Math.random() * this.shapes.length);
            this.nextShape = this.shapes[index];
            this.nextColor = this.colors[index];
        }
        
        this.currentShape = this.nextShape;
        this.currentColor = this.nextColor;
        
        // 生成新的下一个方块
        const index = Math.floor(Math.random() * this.shapes.length);
        this.nextShape = this.shapes[index];
        this.nextColor = this.colors[index];
        
        // 设置初始位置
        this.currentX = Math.floor((this.cols - this.currentShape[0].length) / 2);
        this.currentY = 0;
        
        // 更新预览
        this.updatePreview();
        
        // 检查游戏是否结束
        if (this.checkCollision()) {
            this.gameOver = true;
            this.showGameOver();
        }
    }
    
    updatePreview() {
        const previewCanvas = document.createElement('canvas');
        const size = this.blockSize * 4;
        previewCanvas.width = size;
        previewCanvas.height = size;
        const ctx = previewCanvas.getContext('2d');
        
        // 清除旧的预览
        const container = document.getElementById('previewContainer');
        container.innerHTML = '';
        container.appendChild(previewCanvas);
        
        // 绘制预览方块
        const shape = this.nextShape;
        const offsetX = (size - shape[0].length * this.blockSize) / 2;
        const offsetY = (size - shape.length * this.blockSize) / 2;
        
        shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    ctx.fillStyle = this.nextColor;
                    ctx.fillRect(
                        offsetX + x * this.blockSize,
                        offsetY + y * this.blockSize,
                        this.blockSize - 1,
                        this.blockSize - 1
                    );
                }
            });
        });
    }
    
    moveShape(dir) {
        this.currentX += dir;
        if (this.checkCollision()) {
            this.currentX -= dir;
            return false;
        }
        this.draw();
        return true;
    }
    
    rotateShape() {
        const original = this.currentShape;
        this.currentShape = this.currentShape[0].map((_, i) =>
            this.currentShape.map(row => row[i]).reverse()
        );
        
        if (this.checkCollision()) {
            this.currentShape = original;
            return false;
        }
        
        this.draw();
        return true;
    }
    
    dropShape() {
        this.currentY++;
        if (this.checkCollision()) {
            this.currentY--;
            this.freezeShape();
            this.createNewShape();
            return false;
        }
        this.draw();
        return true;
    }
    
    checkCollision() {
        return this.currentShape.some((row, dy) =>
            row.some((value, dx) => {
                if (!value) return false;
                const newX = this.currentX + dx;
                const newY = this.currentY + dy;
                return (
                    newX < 0 ||
                    newX >= this.cols ||
                    newY >= this.rows ||
                    (newY >= 0 && this.board[newY][newX])
                );
            })
        );
    }
    
    freezeShape() {
        this.currentShape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const boardY = this.currentY + y;
                    if (boardY >= 0) {
                        this.board[boardY][this.currentX + x] = this.currentColor;
                    }
                }
            });
        });
        
        this.clearLines();
    }
    
    updateScore(linesCleared) {
        const oldLevel = this.level;
        // 修改为1分制
        this.score += linesCleared;
        this.lines += linesCleared;
        this.level = Math.min(this.maxLevel, Math.floor(this.lines / 10) + 1);
        
        // 更新显示
        document.getElementById('score').textContent = this.score;
        document.getElementById('lines').textContent = this.lines;
        document.getElementById('level').textContent = this.level;
        
        // 检查是否升级
        if (this.level > oldLevel) {
            soundManager.play('levelUp', 1.0);
        }
        
        // 更新下落速度
        this.dropInterval = Math.max(
            this.minDropInterval,
            1000 - (this.level - 1) * 50
        );
    }
    
    draw() {
        // 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制已固定的方块
        this.board.forEach((row, y) => {
            row.forEach((color, x) => {
                if (color) {
                    this.drawBlock(x, y, color);
                }
            });
        });
        
        // 绘制当前方块
        if (this.currentShape) {
            this.currentShape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        this.drawBlock(
                            this.currentX + x,
                            this.currentY + y,
                            this.currentColor
                        );
                    }
                });
            });
        }
    }
    
    drawBlock(x, y, color) {
        const padding = 1; // 方块间距
        const radius = 4; // 圆角半径
        
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; // 添加浅色边框
        this.ctx.lineWidth = 1;
        
        // 绘制圆角矩形
        this.ctx.beginPath();
        this.ctx.roundRect(
            x * this.blockSize + padding,
            y * this.blockSize + padding,
            this.blockSize - padding * 2,
            this.blockSize - padding * 2,
            radius
        );
        this.ctx.fill();
        this.ctx.stroke();
        
        // 添加高光效果
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.beginPath();
        this.ctx.roundRect(
            x * this.blockSize + padding,
            y * this.blockSize + padding,
            this.blockSize - padding * 2,
            (this.blockSize - padding * 2) / 3,
            radius
        );
        this.ctx.fill();
    }
    
    showGameOver() {
        soundManager.stopBGM();
        soundManager.play('gameOver', 0.8);
        document.querySelector('.game-over').classList.remove('hidden');
        document.getElementById('finalScore').textContent = this.score;
        this.updateLeaderboardDisplay('leaderboardList');
    }
    
    restart() {
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.dropInterval = 1000;
        this.nextShape = null;
        document.querySelector('.game-over').classList.add('hidden');
        document.getElementById('score').textContent = '0';
        document.getElementById('lines').textContent = '0';
        document.getElementById('level').textContent = '1';
        this.createNewShape();
        this.draw();
        
        // 重新开始音乐
        soundManager.stopBGM();
        setTimeout(() => {
            soundManager.play('start', 0.8);
            setTimeout(() => soundManager.playBGM(), 1000);
        }, 500);
    }
    
    update(time = 0) {
        if (this.gameOver) return;
        
        const deltaTime = time - this.lastDrop;
        
        if (deltaTime > this.dropInterval) {
            this.dropShape();
            this.lastDrop = time;
        }
        
        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }
    
    async start() {
        // 播放开始音效和背景音乐
        soundManager.play('start', 0.8);
        setTimeout(() => soundManager.playBGM(), 1000);
        
        this.createNewShape();
        this.update();
    }
    
    clearLines() {
        let linesCleared = 0;
        
        for (let y = this.rows - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(this.cols).fill(0));
                linesCleared++;
                y++; // 检查同一行（因为上面的行下移了）
            }
        }
        
        if (linesCleared > 0) {
            // 更新连击计数和播放音效
            this.combo++;
            if (this.combo > 1) {
                soundManager.play('combo', 0.6 + this.combo * 0.1);
            } else {
                soundManager.play('clear', 0.6 + linesCleared * 0.1);
            }
            this.updateScore(linesCleared);
        } else {
            // 重置连击计数
            this.combo = 0;
        }
    }
    
    loadLeaderboard() {
        const saved = localStorage.getItem('tetrisLeaderboard');
        return saved ? JSON.parse(saved) : [];
    }
    
    saveLeaderboard() {
        localStorage.setItem('tetrisLeaderboard', JSON.stringify(this.leaderboard));
    }
    
    updateLeaderboardDisplay(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        const sortedScores = [...this.leaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
        
        sortedScores.forEach((entry, index) => {
            const div = document.createElement('div');
            div.innerHTML = `${index + 1}. ${entry.name}: ${entry.score}分`;
            container.appendChild(div);
        });
    }
    
    showLeaderboardModal() {
        document.querySelector('.leaderboard-modal').classList.remove('hidden');
        this.updateLeaderboardDisplay('leaderboardListModal');
    }
    
    hideLeaderboardModal() {
        document.querySelector('.leaderboard-modal').classList.add('hidden');
    }
    
    saveScore() {
        const nameInput = document.getElementById('playerName');
        const name = nameInput.value.trim() || '匿名玩家';
        
        this.leaderboard.push({
            name: name,
            score: this.score,
            date: new Date().toISOString()
        });
        
        // 保持前100名记录
        this.leaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard = this.leaderboard.slice(0, 100);
        
        this.saveLeaderboard();
        this.updateLeaderboardDisplay('leaderboardList');
        
        // 清空输入框
        nameInput.value = '';
    }
}

// 创建并启动游戏
window.addEventListener('load', async () => {
    try {
        // 等待声音加载完成
        const game = new TetrisGame();
        await game.start();
        console.log('Game initialized successfully');
    } catch (e) {
        console.error('Error initializing game:', e);
    }
});