class SoundManager {
    constructor() {
        // 创建音频上下文
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        this.soundBuffers = {};
        this.isMuted = false;
        this.bgm = null;
        this.bgmVolume = 0.3;
        this.effectsVolume = 0.6;
        
        // 预加载所有音效
        this.loadSounds();

        // 在用户交互时解锁音频上下文
        this.unlockAudioContext();
    }

    unlockAudioContext() {
        const unlock = () => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            document.removeEventListener('touchstart', unlock);
            document.removeEventListener('touchend', unlock);
            document.removeEventListener('click', unlock);
        };

        document.addEventListener('touchstart', unlock);
        document.addEventListener('touchend', unlock);
        document.addEventListener('click', unlock);
    }

    async loadSounds() {
        const soundFiles = {
            move: 'move.mp3',
            rotate: 'rotate.mp3',
            clear: 'clear.mp3',
            gameOver: 'gameover.mp3',
            levelUp: 'levelup.mp3',
            bgm: 'bgm.mp3',
            start: 'start.mp3',
            button: 'button.mp3'
        };

        // 加载并缓存每个音效
        for (const [name, file] of Object.entries(soundFiles)) {
            try {
                const response = await fetch(`sounds/${file}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                if (name === 'bgm') {
                    this.bgm = audioBuffer;
                } else {
                    this.soundBuffers[name] = audioBuffer;
                }
            } catch (e) {
                console.warn(`Error loading sound ${name}:`, e);
            }
        }
    }

    play(name) {
        if (this.isMuted || !this.soundBuffers[name]) return;

        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.soundBuffers[name];
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // 设置音量
            let volume = this.effectsVolume;
            switch(name) {
                case 'move':
                    volume *= 0.3;
                    break;
                case 'rotate':
                    volume *= 0.4;
                    break;
                case 'clear':
                    volume *= 0.8;
                    break;
                case 'levelUp':
                    volume *= 0.9;
                    break;
                case 'gameOver':
                    volume *= 0.8;
                    break;
                case 'button':
                    volume *= 0.4;
                    break;
                case 'start':
                    volume *= 0.7;
                    break;
            }
            
            gainNode.gain.value = volume;
            source.start(0);
        } catch (e) {
            console.warn(`Error playing sound ${name}:`, e);
        }
    }

    async playBGM() {
        if (this.isMuted || !this.bgm) return;
        
        try {
            if (this.bgmSource) {
                this.bgmSource.stop();
            }

            this.bgmSource = this.audioContext.createBufferSource();
            this.bgmGain = this.audioContext.createGain();
            
            this.bgmSource.buffer = this.bgm;
            this.bgmSource.loop = true;
            this.bgmSource.connect(this.bgmGain);
            this.bgmGain.connect(this.audioContext.destination);

            // 淡入效果
            this.bgmGain.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.bgmGain.gain.linearRampToValueAtTime(
                this.bgmVolume,
                this.audioContext.currentTime + 1
            );

            this.bgmSource.start(0);
        } catch (e) {
            console.warn('Error playing BGM:', e);
        }
    }

    stopBGM() {
        if (!this.bgmSource) return;

        try {
            // 淡出效果
            this.bgmGain.gain.linearRampToValueAtTime(
                0,
                this.audioContext.currentTime + 0.5
            );
            setTimeout(() => {
                this.bgmSource.stop();
                this.bgmSource = null;
            }, 500);
        } catch (e) {
            console.warn('Error stopping BGM:', e);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.isMuted) {
            if (this.bgmGain) {
                this.bgmGain.gain.value = 0;
            }
        } else {
            if (this.bgmGain) {
                this.bgmGain.gain.value = this.bgmVolume;
            }
        }
        
        return this.isMuted;
    }
}

// 创建全局实例
window.soundManager = new SoundManager();
