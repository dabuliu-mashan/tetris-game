class SoundManager {
    constructor() {
        // 检测设备类型
        this.isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
        this.isWechat = /MicroMessenger/i.test(navigator.userAgent);
        this.isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        // 音效对象存储
        this.sounds = {};
        this.soundBuffers = {};
        this.isMuted = false;
        this.bgm = null;
        this.bgmVolume = 0.3;
        this.effectsVolume = 0.6;
        
        // 移动端音效优化
        if (this.isMobile) {
            this.effectsVolume = 1.0; // 移动端提高音量
            this.useSimpleAudio = true; // 移动端使用简单音频模式
            this.audioPool = {}; // 音效池
            this.poolSize = 2; // 移动端减少池大小
        }
        
        // 音频上下文
        this.initAudioContext();
        
        // 音频状态
        this.isAudioReady = false;
        this.lastPlayTime = {}; // 记录每个音效最后播放时间
        
        // 预加载所有音效
        this.loadSounds();
        
        // 在用户交互时解锁音频
        this.unlockAudio();
    }

    initAudioContext() {
        // 移动端使用简单音频模式
        if (this.useSimpleAudio) {
            this.useWebAudio = false;
            return;
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext({
                latencyHint: 'interactive',
                sampleRate: 44100
            });
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

        if (this.useSimpleAudio) {
            // 移动端使用简单音频加载
            for (const [name, file] of Object.entries(soundFiles)) {
                try {
                    const audio = new Audio(`sounds/${file}`);
                    audio.preload = 'auto';
                    
                    if (name === 'bgm') {
                        audio.loop = true;
                        audio.volume = this.bgmVolume;
                        this.bgm = audio;
                    } else {
                        // 创建音效池
                        this.audioPool[name] = [];
                        for (let i = 0; i < this.poolSize; i++) {
                            const poolAudio = new Audio(`sounds/${file}`);
                            poolAudio.preload = 'auto';
                            poolAudio.volume = this.effectsVolume;
                            this.audioPool[name].push(poolAudio);
                        }
                        this.sounds[name] = this.audioPool[name][0];
                    }

                    // 设置音频属性
                    if (this.isIOS) {
                        audio.autoplay = false;
                        audio.playsinline = true;
                        audio.preload = 'auto';
                    }
                } catch (e) {
                    console.warn(`Error loading sound ${name}:`, e);
                }
            }
        } else {
            // 桌面端使用 Web Audio API
            const loadPromises = [];
            for (const [name, file] of Object.entries(soundFiles)) {
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
            }
            await Promise.all(loadPromises);
        }
    }

    play(name) {
        if (this.isMuted) return;

        const now = Date.now();
        // 检查音效播放间隔（移动端特别处理）
        if (this.isMobile) {
            const minInterval = 50; // 最小播放间隔（毫秒）
            if (this.lastPlayTime[name] && now - this.lastPlayTime[name] < minInterval) {
                return;
            }
        }
        this.lastPlayTime[name] = now;

        try {
            if (this.useSimpleAudio) {
                // 移动端简单音频播放
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

                sound.volume = this.effectsVolume;
                
                // 立即播放音效
                if (this.isIOS) {
                    sound.currentTime = 0;
                    sound.play().catch(() => {});
                } else {
                    const playPromise = sound.play();
                    if (playPromise) {
                        playPromise.catch(() => {
                            sound.currentTime = 0;
                            sound.play().catch(() => {});
                        });
                    }
                }
            } else {
                // 桌面端 Web Audio API 播放
                if (!this.soundBuffers[name]) return;
                
                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                
                source.buffer = this.soundBuffers[name];
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                gainNode.gain.value = this.effectsVolume;
                source.start(0);
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
