// app.js
import { EventEmitter } from 'https://cdn.jsdelivr.net/npm/events@3.0.0/events.min.js';

class ConfigManager {
  constructor() {
    const raw = document.getElementById('app-config').textContent;
    this.settings = JSON.parse(raw);
  }
  get(key) { return this.settings[key]; }
}

class Uploader extends EventEmitter {
  constructor(formEl) {
    super();
    this.form = formEl;
    this.input = formEl.querySelector('input[type=file]');
    this.init();
  }
  init() {
    this.form.addEventListener('submit', e => {
      e.preventDefault();
      this.handleFiles([...this.input.files]);
    });
    this.input.addEventListener('change', e => {
      this.emit('files-selected', [...e.target.files]);
    });
  }
  async handleFiles(files) {
    for (const file of files) {
      if (!this.validate(file)) continue;
      try {
        const data = await this.uploadFile(file);
        this.emit('upload-success', data);
      } catch (err) {
        this.emit('upload-error', err);
      }
    }
  }
  validate(file) {
    const maxMB = config.get('maxFileSizeMB');
    const sizeMB = file.size / (1024 * 1024);
    const types = config.get('supportedTypes');
    if (sizeMB > maxMB || !types.includes(file.type)) {
      this.emit('validation-failed', file);
      return false;
    }
    return true;
  }
  uploadFile(file) {
    const endpoint = config.get('apiEndpoint');
    const formData = new FormData();
    formData.append('media', file);
    return fetch(endpoint, { method: 'POST', body: formData })
      .then(res => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      });
  }
}

class Previewer {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.ctx = canvas.getContext('2d');
  }
  showImage(file) {
    const img = new Image();
    img.onload = () => {
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = URL.createObjectURL(file);
  }
  showVideo(file) {
    this.video.src = URL.createObjectURL(file);
    this.video.play();
  }
}

class MediaCard {
  constructor(data) {
    this.data = data;
    this.template = document.getElementById('media-card-template');
  }
  render() {
    const clone = this.template.content.cloneNode(true);
    const wrapper = clone.querySelector('.media-wrapper');
    if (this.data.type.startsWith('image')) {
      const img = document.createElement('img');
      img.src = this.data.url;
      wrapper.appendChild(img);
    } else {
      const vid = document.createElement('video');
      vid.src = this.data.url;
      vid.controls = true;
      wrapper.appendChild(vid);
    }
    clone.querySelector('.media-title').textContent = this.data.title || 'Untitled';
    clone.querySelector('.media-meta').textContent = `${this.data.uploader} • ${new Date(this.data.timestamp).toLocaleString()}`;
    clone.querySelector('.like-count').textContent = this.data.likes || 0;
    clone.querySelector('.download-btn').addEventListener('click', () => this.download());
    clone.querySelector('.like-btn').addEventListener('click', () => this.like());
    return clone;
  }
  like() {
    // optimistic UI update
    const countEl = document.querySelector(`#card-${this.data.id} .like-count`);
    let count = Number(countEl.textContent) + 1;
    countEl.textContent = count;
    fetch(`/api/media/${this.data.id}/like`, { method: 'POST' });
  }
  download() {
    const a = document.createElement('a');
    a.href = this.data.url;
    a.download = this.data.filename || 'download';
    a.click();
  }
}

class Gallery {
  constructor(gridEl) {
    this.grid = gridEl;
    this.page = 0;
    this.busy = false;
  }
  async loadNext() {
    if (this.busy) return;
    this.busy = true;
    this.page++;
    try {
      const res = await fetch(`/api/media?page=${this.page}`);
      if (!res.ok) throw new Error('Failed to load gallery');
      const { items } = await res.json();
      items.forEach(item => {
        const card = new MediaCard(item);
        this.grid.appendChild(card.render());
      });
    } catch (err) {
      console.error(err);
    } finally {
      this.busy = false;
    }
  }
}

const config = new ConfigManager();
const uploader = new Uploader(document.getElementById('upload-form'));
const previewer = new Previewer(document.getElementById('snapshot-canvas'), document.getElementById('preview-video'));
const gallery = new Gallery(document.querySelector('.gallery-grid'));


document.getElementById('load-more').addEventListener('click', () => gallery.loadNext());

document.getElementById('theme-switch').addEventListener('change', e => {
  document.getElementById('snappy-app').classList.toggle('theme-dark', e.target.checked);
  document.getElementById('snappy-app').classList.toggle('theme-light', !e.target.checked);
});

document.addEventListener('DOMContentLoaded', () => gallery.loadNext());
