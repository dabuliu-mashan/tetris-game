class SoundManager {
    constructor() {
        // 检测是否为微信浏览器
        this.isWechat = /MicroMessenger/i.test(navigator.userAgent);
        
        // 音效对象存储
        this.sounds = {};
        this.soundBuffers = {};
        this.isMuted = false;
        this.bgm = null;
        this.bgmVolume = 0.3;
        this.effectsVolume = 0.6;
        
        // 音效缓存池
        this.audioPool = {};
        this.poolSize = 3;
        
        // 如果不是微信，则使用 Web Audio API
        if (!this.isWechat) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.useWebAudio = true;
            } catch (e) {
                console.warn('Web Audio API not supported, falling back to Audio elements');
                this.useWebAudio = false;
            }
        } else {
            this.useWebAudio = false;
        }
        
        // 预加载所有音效
        this.loadSounds();
        
        // 在用户交互时解锁音频
        this.unlockAudio();
    }

    unlockAudio() {
        const unlock = () => {
            if (this.useWebAudio && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // 预加载并播放所有音频文件
            Object.values(this.sounds).forEach(sound => {
                if (sound && sound.play) {
                    const playPromise = sound.play();
                    if (playPromise) {
                        playPromise.then(() => {
                            sound.pause();
                            sound.currentTime = 0;
                        }).catch(() => {});
                    }
                }
            });
            
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

        for (const [name, file] of Object.entries(soundFiles)) {
            try {
                if (this.useWebAudio) {
                    const response = await fetch(`sounds/${file}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    
                    if (name === 'bgm') {
                        this.bgm = audioBuffer;
                    } else {
                        this.soundBuffers[name] = audioBuffer;
                    }
                } else {
                    // 使用传统 Audio 对象并创建音效池
                    this.audioPool[name] = [];
                    for (let i = 0; i < this.poolSize; i++) {
                        const audio = new Audio(`sounds/${file}`);
                        audio.preload = 'auto';
                        
                        if (name === 'bgm') {
                            audio.loop = true;
                            audio.volume = this.bgmVolume;
                            this.bgm = audio;
                        } else {
                            audio.volume = this.effectsVolume;
                            this.audioPool[name].push(audio);
                        }
                    }
                    if (name !== 'bgm') {
                        this.sounds[name] = this.audioPool[name][0];
                    }
                }
            } catch (e) {
                console.warn(`Error loading sound ${name}:`, e);
            }
        }
    }

    play(name) {
        if (this.isMuted) return;

        try {
            if (this.useWebAudio) {
                if (!this.soundBuffers[name]) return;
                
                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                
                source.buffer = this.soundBuffers[name];
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                let volume = this.effectsVolume;
                switch(name) {
                    case 'move': volume *= 0.3; break;
                    case 'rotate': volume *= 0.4; break;
                    case 'clear': volume *= 0.8; break;
                    case 'levelUp': volume *= 0.9; break;
                    case 'gameOver': volume *= 0.8; break;
                    case 'button': volume *= 0.4; break;
                    case 'start': volume *= 0.7; break;
                }
                
                gainNode.gain.value = volume;
                source.start(0);
            } else {
                // 使用音效池中的音频对象
                if (!this.audioPool[name]) return;
                
                // 查找可用的音频对象
                let sound = this.audioPool[name].find(audio => 
                    audio.paused || audio.ended || audio.currentTime === 0
                );
                
                // 如果没有可用的音频对象，重用第一个
                if (!sound) {
                    sound = this.audioPool[name][0];
                    sound.currentTime = 0;
                }

                let volume = this.effectsVolume;
                switch(name) {
                    case 'move': volume *= 0.3; break;
                    case 'rotate': volume *= 0.4; break;
                    case 'clear': volume *= 0.8; break;
                    case 'levelUp': volume *= 0.9; break;
                    case 'gameOver': volume *= 0.8; break;
                    case 'button': volume *= 0.4; break;
                    case 'start': volume *= 0.7; break;
                }
                
                sound.volume = volume;
                
                // 立即播放音效
                const playPromise = sound.play();
                if (playPromise) {
                    playPromise.catch(e => {
                        // 如果播放失败，尝试重置并重新播放
                        sound.currentTime = 0;
                        sound.play().catch(e => console.warn('Error playing sound:', e));
                    });
                }
            }
        } catch (e) {
            console.warn(`Error playing sound ${name}:`, e);
        }
    }

    async playBGM() {
        if (this.isMuted) return;
        
        try {
            if (this.useWebAudio) {
                if (!this.bgm) return;
                
                if (this.bgmSource) {
                    this.bgmSource.stop();
                }

                this.bgmSource = this.audioContext.createBufferSource();
                this.bgmGain = this.audioContext.createGain();
                
                this.bgmSource.buffer = this.bgm;
                this.bgmSource.loop = true;
                this.bgmSource.connect(this.bgmGain);
                this.bgmGain.connect(this.audioContext.destination);

                this.bgmGain.gain.setValueAtTime(0, this.audioContext.currentTime);
                this.bgmGain.gain.linearRampToValueAtTime(
                    this.bgmVolume,
                    this.audioContext.currentTime + 1
                );

                this.bgmSource.start(0);
            } else {
                // 使用传统 Audio 对象
                if (!this.bgm) return;
                
                this.bgm.currentTime = 0;
                this.bgm.volume = 0;
                await this.bgm.play();
                
                // 淡入效果
                const fadeIn = setInterval(() => {
                    if (this.bgm.volume < this.bgmVolume) {
                        this.bgm.volume = Math.min(this.bgm.volume + 0.05, this.bgmVolume);
                    } else {
                        clearInterval(fadeIn);
                    }
                }, 100);
            }
        } catch (e) {
            console.warn('Error playing BGM:', e);
        }
    }

    stopBGM() {
        try {
            if (this.useWebAudio) {
                if (!this.bgmSource) return;
                
                this.bgmGain.gain.linearRampToValueAtTime(
                    0,
                    this.audioContext.currentTime + 0.5
                );
                setTimeout(() => {
                    this.bgmSource.stop();
                    this.bgmSource = null;
                }, 500);
            } else {
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
        } catch (e) {
            console.warn('Error stopping BGM:', e);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        
        try {
            if (this.useWebAudio) {
                if (this.bgmGain) {
                    this.bgmGain.gain.value = this.isMuted ? 0 : this.bgmVolume;
                }
            } else {
                if (this.bgm) {
                    this.bgm.volume = this.isMuted ? 0 : this.bgmVolume;
                }
                Object.values(this.sounds).forEach(sound => {
                    if (sound) {
                        sound.volume = this.isMuted ? 0 : this.effectsVolume;
                    }
                });
            }
        } catch (e) {
            console.warn('Error toggling mute:', e);
        }
        
        return this.isMuted;
    }
}

// 创建全局实例
window.soundManager = new SoundManager();
