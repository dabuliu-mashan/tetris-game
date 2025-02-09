class SoundManager {
    constructor() {
        // 检测是否为移动端
        this.isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
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
        this.poolSize = this.isMobile ? 2 : 3; // 移动端减少池大小
        
        // 音频上下文
        this.initAudioContext();
        
        // 音频状态
        this.isAudioReady = false;
        this.pendingPlay = new Set();
        
        // 预加载所有音效
        this.loadSounds();
        
        // 在用户交互时解锁音频
        this.unlockAudio();
    }

    initAudioContext() {
        // 移动端默认使用 Audio 对象
        if (this.isMobile || this.isWechat) {
            this.useWebAudio = false;
            return;
        }

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.useWebAudio = true;
        } catch (e) {
            console.warn('Web Audio API not supported, falling back to Audio elements');
            this.useWebAudio = false;
        }
    }

    unlockAudio() {
        const unlock = async () => {
            if (!this.isAudioReady) {
                if (this.useWebAudio && this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                
                // 预加载并解锁所有音频
                const unlockPromises = Object.values(this.audioPool).map(pool => {
                    return Promise.all(pool.map(async (audio) => {
                        try {
                            audio.volume = 0;
                            await audio.play();
                            audio.pause();
                            audio.currentTime = 0;
                            audio.volume = this.effectsVolume;
                        } catch (e) {
                            console.warn('Error unlocking audio:', e);
                        }
                    }));
                });

                try {
                    await Promise.all(unlockPromises);
                    this.isAudioReady = true;
                    
                    // 播放待播放的音效
                    this.pendingPlay.forEach(name => this.play(name));
                    this.pendingPlay.clear();
                } catch (e) {
                    console.warn('Error unlocking audio pool:', e);
                }
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

        const loadPromises = [];

        for (const [name, file] of Object.entries(soundFiles)) {
            try {
                if (this.useWebAudio) {
                    const loadPromise = fetch(`sounds/${file}`)
                        .then(response => response.arrayBuffer())
                        .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                        .then(audioBuffer => {
                            if (name === 'bgm') {
                                this.bgm = audioBuffer;
                            } else {
                                this.soundBuffers[name] = audioBuffer;
                            }
                        });
                    loadPromises.push(loadPromise);
                } else {
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

                        // 监听加载错误
                        audio.onerror = (e) => {
                            console.warn(`Error loading sound ${name}:`, e);
                        };

                        const loadPromise = new Promise((resolve) => {
                            audio.oncanplaythrough = resolve;
                        });
                        loadPromises.push(loadPromise);
                    }
                    if (name !== 'bgm') {
                        this.sounds[name] = this.audioPool[name][0];
                    }
                }
            } catch (e) {
                console.warn(`Error loading sound ${name}:`, e);
            }
        }

        // 等待所有音效加载完成
        try {
            await Promise.all(loadPromises);
            console.log('All sounds loaded successfully');
        } catch (e) {
            console.warn('Error loading sounds:', e);
        }
    }

    play(name) {
        if (this.isMuted) return;

        // 如果音频系统还未就绪，将音效加入待播放队列
        if (!this.isAudioReady) {
            this.pendingPlay.add(name);
            return;
        }

        try {
            if (this.useWebAudio) {
                if (!this.soundBuffers[name]) return;
                
                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                
                source.buffer = this.soundBuffers[name];
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                let volume = this.getVolumeForSound(name);
                gainNode.gain.value = volume;
                source.start(0);
            } else {
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

                sound.volume = this.getVolumeForSound(name);
                
                // 立即播放音效
                const playPromise = sound.play();
                if (playPromise) {
                    playPromise.catch(e => {
                        if (e.name === 'NotAllowedError') {
                            // 用户交互限制，将音效加入待播放队列
                            this.pendingPlay.add(name);
                        } else {
                            console.warn(`Error playing sound ${name}:`, e);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn(`Error playing sound ${name}:`, e);
        }
    }

    getVolumeForSound(name) {
        let volume = this.effectsVolume;
        switch(name) {
            case 'move': volume *= this.isMobile ? 0.4 : 0.3; break;
            case 'rotate': volume *= this.isMobile ? 0.5 : 0.4; break;
            case 'clear': volume *= this.isMobile ? 0.9 : 0.8; break;
            case 'levelUp': volume *= this.isMobile ? 1.0 : 0.9; break;
            case 'gameOver': volume *= this.isMobile ? 0.9 : 0.8; break;
            case 'button': volume *= this.isMobile ? 0.5 : 0.4; break;
            case 'start': volume *= this.isMobile ? 0.8 : 0.7; break;
        }
        return volume;
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
