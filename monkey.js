// ==UserScript==
// @name         华科课程平台刷课助手
// @namespace    http://tampermonkey.net/
// @version      0.0.3
// @description  华中科技大学课程平台刷课助手，点击右上角开始自动刷课（可选是否跳过测验），可以自动刷完所有视频
// @author       DavLiu
// @license      MIT
// @include        *://smartcourse.hust.edu.cn/*
// @include        *://smartcourse.hust.edu.cn/mooc-smartcourse/*
// @include        *://smartcourse.hust.edu.cn/mooc-smartcourse/mycourse/studentstudy*
// @match          *://smartcourse.hust.edu.cn/mycourse/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hust.edu.cn
// @grant        none
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/522785/%E5%8D%8E%E7%A7%91%E8%AF%BE%E7%A8%8B%E5%B9%B3%E5%8F%B0%E5%88%B7%E8%AF%BE%E5%8A%A9%E6%89%8B.user.js
// @updateURL https://update.greasyfork.org/scripts/522785/%E5%8D%8E%E7%A7%91%E8%AF%BE%E7%A8%8B%E5%B9%B3%E5%8F%B0%E5%88%B7%E8%AF%BE%E5%8A%A9%E6%89%8B.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // 防止脚本在各种隐藏中重复运行报错
    if (window.top !== window.self) {
        return;
    }

    let isAutoPlay = false;
    let mainTimer = null;
    let skipNonVideoTasks = localStorage.getItem('__skipNonVideoTasks') === 'true';

    function showLog(msg, isError = false) {
        console[isError ? 'error' : 'log']('【刷课助手】' + msg);
        const btn = document.querySelector('.video-helper-btn');
        if (btn && isAutoPlay) {
            btn.innerHTML = '⏸ ' + msg.substring(0, 15) + '...';
        }
    }

    function isStudyPage() {
        return window.location.href.includes('studentstudy') &&
            !window.location.href.includes('login');
    }

    function addControlPanel() {
        if (document.querySelector('.video-helper-panel')) return;
        if (!document.body) return; // 确保 body 存在

        const panel = document.createElement('div');
        panel.className = 'video-helper-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            background: #ffffff;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-width: 180px;
            border: 1px solid #e0e0e0;
        `;

        const button = document.createElement('button');
        button.className = 'video-helper-btn';
        button.innerHTML = '▶ 开始自动刷课';
        button.style.cssText = `
            padding: 10px 15px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: background 0.3s ease;
            text-align: center;
        `;
        button.onclick = toggleAutoPlay;

        const label = document.createElement('label');
        label.style.cssText = `
            font-size: 13px;
            color: #555;
            display: flex;
            align-items: center;
            cursor: pointer;
            user-select: none;
        `;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'margin-right: 8px; cursor: pointer;';
        checkbox.checked = skipNonVideoTasks;

        checkbox.onchange = (e) => {
            skipNonVideoTasks = e.target.checked;
            localStorage.setItem('__skipNonVideoTasks', skipNonVideoTasks);
            console.log('【刷课助手】跳过非视频任务设置已更改为:', skipNonVideoTasks);
        };

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode('遇到测验等自动跳过'));

        panel.appendChild(button);
        panel.appendChild(label);
        document.body.appendChild(panel);
    }

    function toggleAutoPlay() {
        const btn = document.querySelector('.video-helper-btn');
        isAutoPlay = !isAutoPlay;

        if (isAutoPlay) {
            btn.style.background = '#f44336';
            showLog('已开启，正在初始化...');
            runTaskLoop();
        } else {
            btn.innerHTML = '▶ 开始自动刷课';
            btn.style.background = '#4CAF50';
            clearTimeout(mainTimer);
            console.log('【刷课助手】已手动停止');
        }
    }

    function runTaskLoop() {
        if (!isAutoPlay) return;

        const mainFrame = document.getElementById('iframe');
        if (!mainFrame || !mainFrame.contentWindow || !mainFrame.contentWindow.document) {
            showLog('等待主框架加载中...');
            mainTimer = setTimeout(runTaskLoop, 3000);
            return;
        }

        const mainDoc = mainFrame.contentWindow.document;
        const innerFrames = Array.from(mainDoc.querySelectorAll('iframe'));

        let needWait = false;
        let hasOtherUnfinishedTasks = false;

        for (const frame of innerFrames) {
            const parentContainer = frame.closest('.ans-attach-ct') || frame.parentElement;
            const isJob = parentContainer && (parentContainer.querySelector('.ans-job-icon') || parentContainer.classList.contains('ans-job-icon') || parentContainer.classList.contains('ans-attach-ct'));
            const isFinishedByPlatform = parentContainer && parentContainer.classList.contains('ans-job-finished');

            if (!isJob || isFinishedByPlatform) continue;

            const isVideo = frame.classList.contains('ans-insertvideo-online') || (frame.src && frame.src.includes('video'));

            if (isVideo) {
                needWait = true;

                let isHackedByUs = false;
                let isInjected = false;

                try {
                    isHackedByUs = frame.contentWindow.__video_hacked === true;
                    isInjected = frame.contentWindow.__inject_flag === true;
                } catch(e) {}

                if (isHackedByUs) {
                    needWait = false;
                } else if (!isInjected) {
                    showLog('注入核心刷课逻辑...');
                    try {
                        frame.contentWindow.eval(`
                            window.__inject_flag = true;
                            function modifyPlayer() {
                                if(typeof videojs === 'undefined' || !videojs.getAllPlayers().length) {
                                    setTimeout(modifyPlayer, 1000);
                                    return;
                                }

                                const player = videojs.getAllPlayers()[0];
                                if(player) {
                                    try {
                                        player.muted(true);
                                        player.play();
                                    } catch(e) {}

                                    let d = player.duration();
                                    if (isNaN(d) || d <= 0) {
                                        setTimeout(modifyPlayer, 1000);
                                        return;
                                    }

                                    try {
                                        player.currentTime(d);
                                        player.trigger('ended');

                                        player.reportProgress = function() {
                                            return {
                                                completed: true,
                                                duration: this.duration(),
                                                position: this.duration()
                                            };
                                        };

                                        if(typeof ed_complete === 'function') {
                                            setTimeout(ed_complete, 1000);
                                        }

                                        window.__video_hacked = true;
                                        console.log('视频处理完成！');
                                    } catch(e) {
                                        console.error('处理视频时出错:', e);
                                        setTimeout(modifyPlayer, 1000);
                                    }
                                } else {
                                    setTimeout(modifyPlayer, 1000);
                                }
                            }
                            modifyPlayer();
                        `);
                    } catch(e) {}
                } else {
                    showLog('等待获取视频时长...');
                }
            } else {
                hasOtherUnfinishedTasks = true;
            }
        }

        if (needWait) {
            mainTimer = setTimeout(runTaskLoop, 2000);
        } else if (hasOtherUnfinishedTasks && !skipNonVideoTasks) {
            showLog('遇到测验/非视频任务');
            toggleAutoPlay();
            alert('【刷课助手】停！前面有测验题或者阅读任务，请手动完成后再点击继续！(你也可以在右上角勾选“自动跳过”)');
        } else {
            if (hasOtherUnfinishedTasks && skipNonVideoTasks) {
                showLog('已自动跳过非视频任务...');
            } else {
                showLog('缓冲5秒等待服务器记录...');
            }
            mainTimer = setTimeout(goToNextNode, 5000);
        }
    }

    function goToNextNode() {
        if (!isAutoPlay) return;

        const activeTab = document.querySelector('#prev_tab .prev_ul li.active');
        if (activeTab && activeTab.nextElementSibling) {
            showLog('切换同节下一标签...');
            activeTab.nextElementSibling.click();
            mainTimer = setTimeout(runTaskLoop, 4000);
            return;
        }

        const allNodes = Array.from(document.querySelectorAll('.posCatalog_name'));
        const activeNode = document.querySelector('.posCatalog_active .posCatalog_name') || document.querySelector('.posCatalog_active');

        if (allNodes.length > 0 && activeNode) {
            const currentIndex = allNodes.indexOf(activeNode);
            if (currentIndex !== -1 && currentIndex + 1 < allNodes.length) {
                showLog('切换下一小节...');
                allNodes[currentIndex + 1].click();
                mainTimer = setTimeout(runTaskLoop, 6000);
                return;
            }
        }

        showLog('全部刷完啦！');
        toggleAutoPlay();
        alert('🎉 恭喜！目录到底了，所有能刷的视频应该都刷完啦！');
    }

    function init() {
        if (!isStudyPage()) return;
        addControlPanel();
    }

    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            if (document.readyState === 'complete') init();
        }
    }).observe(document, { subtree: true, childList: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
