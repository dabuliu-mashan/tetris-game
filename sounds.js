class SoundManager {
    constructor() {
        // 音效对象存储
        this.sounds = {};
        this.isMuted = false;
        this.bgm = null;
        this.bgmVolume = 0.3;
        this.effectsVolume = 0.6;
        
        // 预加载所有音效
        this.loadSounds();
    }

    loadSounds() {
        // 定义所有音效
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

        // 加载每个音效
        Object.entries(soundFiles).forEach(([name, file]) => {
            const audio = new Audio(`sounds/${file}`);
            audio.preload = 'auto';
            
            if (name === 'bgm') {
                audio.loop = true;
                audio.volume = this.bgmVolume;
                this.bgm = audio;
            } else {
                audio.volume = this.effectsVolume;
                this.sounds[name] = audio;
            }
        });
    }

    play(name) {
        if (this.isMuted || !this.sounds[name]) return;

        try {
            // 创建音效的新实例以允许重叠播放
            const sound = this.sounds[name].cloneNode();
            
            // 根据不同音效类型设置音量
            switch(name) {
                case 'move':
                    sound.volume = this.effectsVolume * 0.3;
                    break;
                case 'rotate':
                    sound.volume = this.effectsVolume * 0.4;
                    break;
                case 'clear':
                    sound.volume = this.effectsVolume * 0.8;
                    break;
                case 'levelUp':
                    sound.volume = this.effectsVolume * 0.9;
                    break;
                case 'gameOver':
                    sound.volume = this.effectsVolume * 0.8;
                    break;
                case 'button':
                    sound.volume = this.effectsVolume * 0.4;
                    break;
                case 'start':
                    sound.volume = this.effectsVolume * 0.7;
                    break;
                default:
                    sound.volume = this.effectsVolume;
            }
            
            sound.play().catch(e => console.warn('Error playing sound:', e));
        } catch (e) {
            console.warn(`Error playing sound ${name}:`, e);
        }
    }

    playBGM() {
        if (this.isMuted || !this.bgm) return;
        
        try {
            // 重置BGM到开始
            this.bgm.currentTime = 0;
            // 设置音量并播放
            this.bgm.volume = 0;
            this.bgm.play()
                .then(() => {
                    // 淡入效果
                    const fadeIn = setInterval(() => {
                        if (this.bgm.volume < this.bgmVolume) {
                            this.bgm.volume = Math.min(this.bgm.volume + 0.05, this.bgmVolume);
                        } else {
                            clearInterval(fadeIn);
                        }
                    }, 100);
                })
                .catch(e => console.warn('Error playing BGM:', e));
        } catch (e) {
            console.warn('Error starting BGM:', e);
        }
    }

    stopBGM() {
        if (!this.bgm) return;

        // 淡出效果
        const fadeOut = setInterval(() => {
            if (this.bgm.volume > 0.05) {
                this.bgm.volume = Math.max(this.bgm.volume - 0.05, 0);
            } else {
                this.bgm.pause();
                this.bgm.currentTime = 0;
                clearInterval(fadeOut);
            }
        }, 100);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.isMuted) {
            this.bgm.volume = 0;
            Object.values(this.sounds).forEach(sound => sound.volume = 0);
        } else {
            this.bgm.volume = this.bgmVolume;
            Object.values(this.sounds).forEach(sound => sound.volume = this.effectsVolume);
        }
        
        return this.isMuted;
    }
}

// 创建全局实例
window.soundManager = new SoundManager();
