class SoundManager {
    constructor() {
        // 检测设备类型
        this.isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
        this.isWechat = /MicroMessenger/i.test(navigator.userAgent);
        this.isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        // 音频状态
        this.isInitialized = false;
        this.isMuted = false;
        this.audioContext = null;
        this.soundBuffers = new Map();
        this.audioPool = new Map();
        
        // 音量设置
        this.bgmVolume = this.isMobile ? 0.5 : 0.3;
        this.effectsVolume = this.isMobile ? 0.8 : 0.6;
        
        // 音频文件配置
        this.soundFiles = {
            move: { url: 'sounds/move.mp3', poolSize: 3 },
            rotate: { url: 'sounds/rotate.mp3', poolSize: 3 },
            clear: { url: 'sounds/clear.mp3', poolSize: 2 },
            gameOver: { url: 'sounds/gameover.mp3', poolSize: 1 },
            levelUp: { url: 'sounds/levelup.mp3', poolSize: 1 },
            bgm: { url: 'sounds/bgm.mp3', poolSize: 1 },
            start: { url: 'sounds/start.mp3', poolSize: 1 },
            button: { url: 'sounds/button.mp3', poolSize: 2 }
        };
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // 初始化音频上下文
            if (!this.isWechat && !this.isMobile) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext({
                    latencyHint: 'interactive',
                    sampleRate: 44100
                });
            }

            // 预加载所有音频
            await this.preloadSounds();
            
            // 标记初始化完成
            this.isInitialized = true;
            console.log('Sound system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize sound system:', error);
        }
    }

    async preloadSounds() {
        const loadPromises = [];

        for (const [name, config] of Object.entries(this.soundFiles)) {
            if (this.audioContext) {
                // Web Audio API 方式加载
                loadPromises.push(
                    fetch(config.url)
                        .then(response => response.arrayBuffer())
                        .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                        .then(audioBuffer => {
                            this.soundBuffers.set(name, audioBuffer);
                        })
                );
            } else {
                // 传统 Audio 对象方式加载
                const pool = [];
                for (let i = 0; i < config.poolSize; i++) {
                    const audio = new Audio(config.url);
                    audio.preload = 'auto';
                    
                    if (name === 'bgm') {
                        audio.loop = true;
                        audio.volume = this.bgmVolume;
                    } else {
                        audio.volume = this.effectsVolume;
                    }

                    // 设置音频属性
                    if (this.isIOS) {
                        audio.autoplay = false;
                        audio.playsinline = true;
                    }

                    const loadPromise = new Promise((resolve) => {
                        audio.addEventListener('canplaythrough', resolve, { once: true });
                        audio.load();
                    });

                    pool.push(audio);
                    loadPromises.push(loadPromise);
                }
                this.audioPool.set(name, pool);
            }
        }

        await Promise.all(loadPromises);
    }

    play(name, volume = 1) {
        if (!this.isInitialized || this.isMuted) return;

        try {
            if (this.audioContext) {
                this.playWithWebAudio(name, volume);
            } else {
                this.playWithAudioElement(name, volume);
            }
        } catch (error) {
            console.warn(`Error playing sound ${name}:`, error);
        }
    }

    playWithWebAudio(name, volume) {
        const buffer = this.soundBuffers.get(name);
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        gainNode.gain.value = this.effectsVolume * volume;
        source.start(0);
    }

    playWithAudioElement(name, volume) {
        const pool = this.audioPool.get(name);
        if (!pool) return;

        // 查找可用的音频对象
        let audio = pool.find(a => a.paused || a.ended);
        if (!audio) {
            audio = pool[0];
            audio.currentTime = 0;
        }

        audio.volume = this.effectsVolume * volume;
        
        const playPromise = audio.play();
        if (playPromise) {
            playPromise.catch(() => {
                // 如果播放失败，静默处理
                audio.currentTime = 0;
            });
        }
    }

    async playBGM() {
        if (!this.isInitialized || this.isMuted) return;

        try {
            if (this.audioContext) {
                // Web Audio API BGM 播放
                const buffer = this.soundBuffers.get('bgm');
                if (!buffer) return;

                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                
                source.buffer = buffer;
                source.loop = true;
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(
                    this.bgmVolume,
                    this.audioContext.currentTime + 1
                );

                source.start(0);
                this.bgmSource = source;
                this.bgmGain = gainNode;
            } else {
                // 传统 Audio BGM 播放
                const bgmPool = this.audioPool.get('bgm');
                if (!bgmPool || !bgmPool[0]) return;

                const bgm = bgmPool[0];
                bgm.currentTime = 0;
                bgm.volume = 0;
                
                await bgm.play();
                
                // 淡入效果
                const fadeIn = setInterval(() => {
                    if (bgm.volume < this.bgmVolume) {
                        bgm.volume = Math.min(bgm.volume + 0.05, this.bgmVolume);
                    } else {
                        clearInterval(fadeIn);
                    }
                }, 100);
            }
        } catch (error) {
            console.warn('Error playing BGM:', error);
        }
    }

    stopBGM() {
        try {
            if (this.audioContext && this.bgmSource) {
                const now = this.audioContext.currentTime;
                this.bgmGain.gain.linearRampToValueAtTime(0, now + 0.5);
                setTimeout(() => {
                    this.bgmSource.stop();
                    this.bgmSource = null;
                }, 500);
            } else {
                const bgmPool = this.audioPool.get('bgm');
                if (!bgmPool || !bgmPool[0]) return;

                const bgm = bgmPool[0];
                const fadeOut = setInterval(() => {
                    if (bgm.volume > 0.05) {
                        bgm.volume = Math.max(bgm.volume - 0.05, 0);
                    } else {
                        bgm.pause();
                        bgm.currentTime = 0;
                        clearInterval(fadeOut);
                    }
                }, 100);
            }
        } catch (error) {
            console.warn('Error stopping BGM:', error);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        
        try {
            if (this.audioContext) {
                if (this.bgmGain) {
                    this.bgmGain.gain.value = this.isMuted ? 0 : this.bgmVolume;
                }
            } else {
                const bgmPool = this.audioPool.get('bgm');
                if (bgmPool && bgmPool[0]) {
                    bgmPool[0].volume = this.isMuted ? 0 : this.bgmVolume;
                }

                // 更新所有音效的音量
                for (const [name, pool] of this.audioPool.entries()) {
                    if (name !== 'bgm') {
                        pool.forEach(audio => {
                            audio.volume = this.isMuted ? 0 : this.effectsVolume;
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('Error toggling mute:', error);
        }
        
        return this.isMuted;
    }
}

// 创建全局实例
window.soundManager = new SoundManager();
