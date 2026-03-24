const NEWS_GRID = document.getElementById('news-grid');
const LOADING = document.getElementById('loading');
const ERROR_MESSAGE = document.getElementById('error-message');
const LAST_UPDATE = document.getElementById('last-update');

function formatDate(dateString) {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function createNewsCard(article, index) {
    const card = document.createElement('article');
    card.className = 'news-card';
    card.style.animationDelay = `${index * 0.1}s`;

    const imageUrl = article.image || 'https://via.placeholder.com/600x400?text=Sin+imagen';
    const title = article.title || 'Título no disponible';
    const description = article.description || 'Descripción no disponible';
    const url = article.url || '#';
    const source = article.source?.name || 'Fuente unknown';
    const author = article.author || null;
    const publishedAt = formatDate(article.publishedAt);

    card.innerHTML = `
        <div class="news-card__image-container">
            <img src="${imageUrl}" alt="${title}" class="news-card__image" loading="lazy">
        </div>
        <div class="news-card__content">
            <div class="news-card__meta">
                <span class="news-card__source">${source}</span>
                <span class="news-card__date">${publishedAt}</span>
            </div>
            <h2 class="news-card__title">${title}</h2>
            <p class="news-card__description">${description}</p>
            ${author ? `<p class="news-card__author">Por: ${author}</p>` : ''}
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="news-card__button">
                Leer más
            </a>
        </div>
    `;

    return card;
}

function renderNews(articles) {
    NEWS_GRID.innerHTML = '';
    
    if (!articles || articles.length === 0) {
        ERROR_MESSAGE.querySelector('p').textContent = 'No hay noticias disponibles.';
        ERROR_MESSAGE.style.display = 'block';
        return;
    }

    articles.forEach((article, index) => {
        const card = createNewsCard(article, index);
        NEWS_GRID.appendChild(card);
    });

    const now = new Date();
    LAST_UPDATE.textContent = now.toLocaleString('es-ES');
}

function handleError(error) {
    console.error('Error al cargar noticias:', error);
    LOADING.style.display = 'none';
    ERROR_MESSAGE.style.display = 'block';
}

async function loadNews() {
    try {
        const response = await fetch('./noticias.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        LOADING.style.display = 'none';
        renderNews(data);
        
    } catch (error) {
        handleError(error);
    }
}

document.addEventListener('DOMContentLoaded', loadNews);
