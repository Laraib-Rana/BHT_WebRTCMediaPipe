const videoElement = document.getElementById('raw-video');
const canvasElement = document.getElementById('output-canvas');
const ctx = canvasElement.getContext('2d');
const btnCamera = document.getElementById('btn-camera');
const btnRecord = document.getElementById('btn-record');
const filterSelect = document.getElementById('filter-select');
const toggleArMask = document.getElementById('toggle-ar-mask');
const recordingIndicator = document.getElementById('recording-indicator');
const errorAlert = document.getElementById('error-alert');
const statusTag = document.getElementById('status-tag');

let streamInstance = null;
let activeAnimationId = null;
let mediaRecorder = null;
let capturedChunks = [];
let isRecording = false;

btnCamera.addEventListener('click', async () => {
    errorAlert.classList.add('d-none');
    try {
        const streamConstraints = {
            video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
            audio: false 
        };

        streamInstance = await navigator.mediaDevices.getUserMedia(streamConstraints);
        videoElement.srcObject = streamInstance;
        
        statusTag.innerText = "Pipeline Active";
        statusTag.className = "badge bg-success font-monospace";
        btnCamera.innerText = "✓ Camera Active";
        btnCamera.classList.remove('btn-primary');
        btnCamera.classList.add('btn-outline-success');
        btnCamera.disabled = true;
        btnRecord.disabled = false;

        videoElement.onloadedmetadata = () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            executePipelineLoop();
        };

    } catch (err) {
        statusTag.innerText = "Pipe Failure";
        statusTag.className = "badge bg-danger font-monospace";
        errorAlert.innerText = `Camera Permission Access Denied/Failed: ${err.message}`;
        errorAlert.classList.remove('d-none');
    }
});
function executePipelineLoop() {
    if (videoElement.paused || videoElement.ended) return;

    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    let frameImageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    let pixelArray = frameImageData.data;

    const selectedFilter = filterSelect.value;

    if (selectedFilter !== 'none') {
        for (let i = 0; i < pixelArray.length; i += 4) {
            let r = pixelArray[i];
            let g = pixelArray[i + 1];
            let b = pixelArray[i + 2];

            if (selectedFilter === 'grayscale') {
                let grayIntensity = 0.299 * r + 0.587 * g + 0.114 * b;
                pixelArray[i] = grayIntensity;    
                pixelArray[i + 1] = grayIntensity; 
                pixelArray[i + 2] = grayIntensity; 
            } 
            else if (selectedFilter === 'invert') {
                pixelArray[i] = 255 - r;
                pixelArray[i + 1] = 255 - g;
                pixelArray[i + 2] = 255 - b;
            } 
            else if (selectedFilter === 'cyberpunk') {
                pixelArray[i] = r * 0.8; 
                pixelArray[i + 1] = g * 1.5; 
                pixelArray[i + 2] = b * 2.2;
            }
        }
        ctx.putImageData(frameImageData, 0, 0);
    }
    if (selectedFilter === 'pixelate') {
        applyRetroPixelation(12);
    }

    if (toggleArMask.checked) {
        applyARVirtualMask();
    }

    activeAnimationId = requestAnimationFrame(executePipelineLoop);
}
function applyRetroPixelation(blockSize) {
    const w = canvasElement.width;
    const h = canvasElement.height;
    for (let y = 0; y < h; y += blockSize) {
        for (let x = 0; x < w; x += blockSize) {
            const blockData = ctx.getImageData(x, y, 1, 1).data;
            ctx.fillStyle = `rgb(${blockData[0]}, ${blockData[1]}, ${blockData[2]})`;
            ctx.fillRect(x, y, blockSize, blockSize);
        }
    }
}

function applyARVirtualMask() {
    const w = canvasElement.width;
    const h = canvasElement.height;
    const centerPointX = w / 2;
    const centerPointY = h / 2 - 20;

    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ff0055";
    ctx.strokeStyle = "#ff0055";
    ctx.lineWidth = 4;
    ctx.fillStyle = "rgba(255, 0, 85, 0.15)";

    ctx.beginPath();
    ctx.moveTo(centerPointX - 120, centerPointY - 25);
    ctx.lineTo(centerPointX + 120, centerPointY - 25);
    ctx.lineTo(centerPointX + 100, centerPointY + 25);
    ctx.lineTo(centerPointX - 100, centerPointY + 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#00f2fe";
    ctx.shadowColor = "#00f2fe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerPointX, centerPointY, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}
btnRecord.addEventListener('click', () => {
    if (!isRecording) {
        capturedChunks = [];
        const canvasStreamStream = canvasElement.captureStream(30);
        
        mediaRecorder = new MediaRecorder(canvasStreamStream, { mimeType: 'video/webm;codecs=vp9' });
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                capturedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blobFile = new Blob(capturedChunks, { type: 'video/webm' });
            const temporaryDownloadUrl = URL.createObjectURL(blobFile);
            
            const linkElement = document.createElement('a');
            linkElement.href = temporaryDownloadUrl;
            linkElement.download = `BHT_MediaPipe_Capture_${Date.now()}.webm`;
            document.body.appendChild(linkElement);
            linkElement.click();
            document.body.removeChild(linkElement);
        };

        mediaRecorder.start();
        isRecording = true;
        btnRecord.innerText = "🛑 Stop & Export";
        btnRecord.className = "btn btn-danger btn-sm w-100 fw-bold";
        recordingIndicator.classList.remove('d-none');
    } else {
        mediaRecorder.stop();
        isRecording = false;
        btnRecord.innerText = "📹 Record Clip";
        btnRecord.className = "btn btn-warning btn-sm w-100 fw-bold";
        recordingIndicator.classList.add('d-none');
    }
});