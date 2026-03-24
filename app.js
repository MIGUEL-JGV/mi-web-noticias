const NEWS_GRID = document.getElementById('news-grid');
const LOADING = document.getElementById('loading');
const ERROR_MESSAGE = document.getElementById('error-message');
const LAST_UPDATE = document.getElementById('last-update');
const LOAD_MORE_BTN = document.getElementById('load-more-btn');
const LOAD_MORE_CONTAINER = document.getElementById('load-more-container');

const GNEWS_SEARCH_URL = 'https://gnews.io/api/v4/search';
const CORS_PROXY = 'https://corsproxy.io/?';
const API_KEY = 'f7dd3bdfc7d0be7ad387c9ac52032fc1';

let currentCategory = 'general';
let allArticles = [];
let currentPage = 1;
let isLoadingMore = false;
let isSearchMode = false;
let currentSearchQuery = '';

function normalizeString(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

function isArticleDuplicate(newArticle, existingArticles) {
    const newUrl = normalizeString(newArticle.url);
    const newTitle = normalizeString(newArticle.title);
    const newDescription = normalizeString(newArticle.description?.substring(0, 100));
    
    return existingArticles.some(article => {
        const existingUrl = normalizeString(article.url);
        const existingTitle = normalizeString(article.title);
        const existingDescription = normalizeString(article.description?.substring(0, 100));
        
        if (newUrl && existingUrl && newUrl === existingUrl) return true;
        if (newTitle && existingTitle && newTitle === existingTitle) return true;
        if (newDescription && existingDescription && 
            newDescription.length > 20 && existingDescription === existingDescription) return true;
        
        return false;
    });
}

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
    const content = article.content || description;
    const url = article.url || '#';
    const source = article.source?.name || 'Fuente unknown';
    const sourceUrl = article.source?.url || '#';
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
            <button class="news-card__button read-more-btn" 
                data-title="${encodeURIComponent(title)}" 
                data-content="${encodeURIComponent(content)}" 
                data-url="${encodeURIComponent(url)}" 
                data-source="${encodeURIComponent(source)}" 
                data-source-url="${encodeURIComponent(sourceUrl)}" 
                data-image="${encodeURIComponent(imageUrl)}" 
                data-published="${encodeURIComponent(publishedAt)}">
                Leer más
            </button>
        </div>
    `;

    return card;
}

const MODAL = document.getElementById('news-modal');
const MODAL_CLOSE = document.getElementById('modal-close');
const MODAL_LOADING = document.getElementById('modal-loading');

async function fetchArticleContent(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const selectors = [
            'article[itemprop="articleBody"]',
            '[data-component="text-block"]',
            '[class*="article-body"]',
            '[class*="ArticleBody"]',
            '[class*="story-body"]',
            '[class*="post-content"]',
            '[class*="entry-content"]',
            '[class*="news-body"]',
            '[class*="content-body"]',
            '.article-content',
            '.story-content',
            '.post-body',
            'article',
            'main',
            '[role="main"]'
        ];
        
        let articleText = '';
        
        for (const selector of selectors) {
            const element = doc.querySelector(selector);
            if (element) {
                const paragraphs = element.querySelectorAll('p');
                if (paragraphs.length > 0) {
                    articleText = Array.from(paragraphs)
                        .map(p => p.textContent.trim())
                        .filter(text => text.length > 20)
                        .join('\n\n');
                    if (articleText.length > 300) break;
                }
            }
        }
        
        if (!articleText || articleText.length < 300) {
            const allParagraphs = doc.querySelectorAll('p');
            const filteredParagraphs = Array.from(allParagraphs)
                .map(p => p.textContent.trim())
                .filter(text => text.length > 50 && !text.includes('Suscrib') && !text.includes('Newsletter'))
                .slice(0, 20);
            
            if (filteredParagraphs.length > 3) {
                articleText = filteredParagraphs.join('\n\n');
            }
        }
        
        return articleText && articleText.length > 200 ? articleText : null;
    } catch (error) {
        console.error('Error fetching article:', error);
        return null;
    }
}

async function openModal(btn) {
    const title = decodeURIComponent(btn.dataset.title);
    const content = decodeURIComponent(btn.dataset.content);
    const url = decodeURIComponent(btn.dataset.url);
    const source = decodeURIComponent(btn.dataset.source);
    const image = decodeURIComponent(btn.dataset.image);
    const published = decodeURIComponent(btn.dataset.published);

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-image').src = image;
    document.getElementById('modal-image').alt = title;
    document.getElementById('modal-source').textContent = source;
    document.getElementById('modal-date').textContent = published;
    document.getElementById('modal-link').href = url;
    
    MODAL_LOADING.style.display = 'block';
    document.getElementById('modal-content').style.display = 'none';
    document.getElementById('modal-link').style.display = 'none';

    MODAL.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const fullContent = await fetchArticleContent(url);
    
    MODAL_LOADING.style.display = 'none';
    document.getElementById('modal-content').style.display = 'block';
    document.getElementById('modal-link').style.display = 'inline-block';

    if (fullContent) {
        document.getElementById('modal-content').innerHTML = fullContent.split('\n\n').map(p => `<p>${p}</p>`).join('');
    } else {
        document.getElementById('modal-content').innerHTML = `<p style="font-style: italic; color: #666; margin-bottom: 1rem;">📝 Este es un resumen de la noticia. Para leer la versión completa, usa el botón de abajo.</p><p>${content}</p>`;
    }
}

function closeModal() {
    MODAL.style.display = 'none';
    document.body.style.overflow = '';
    
    const backToTop = document.getElementById('modal-back-to-top');
    if (backToTop) backToTop.classList.remove('visible');
}

if (MODAL_CLOSE) {
    MODAL_CLOSE.addEventListener('click', closeModal);
}

MODAL?.addEventListener('click', (e) => {
    if (e.target === MODAL) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && MODAL?.style.display === 'flex') closeModal();
});

const backToTopBtn = document.getElementById('modal-back-to-top');
if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
        const modalContent = document.querySelector('.modal__content');
        if (modalContent) modalContent.scrollTop = 0;
    });
    
    const modalContent = document.querySelector('.modal__content');
    if (modalContent) {
        modalContent.addEventListener('scroll', () => {
            if (modalContent.scrollTop > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
    }
}

function renderNews(articles, append = false) {
    if (!append) {
        NEWS_GRID.innerHTML = '';
        allArticles = [];
    }
    
    if (!articles || articles.length === 0) {
        if (!append) {
            ERROR_MESSAGE.querySelector('p').textContent = 'No hay noticias disponibles.';
            ERROR_MESSAGE.style.display = 'block';
        }
        return;
    }

    const startIndex = append ? allArticles.length : 0;
    allArticles = append ? [...allArticles, ...articles] : articles;

    articles.forEach((article, index) => {
        const card = createNewsCard(article, startIndex + index);
        NEWS_GRID.appendChild(card);
    });

    document.querySelectorAll('.read-more-btn').forEach(btn => {
        btn.addEventListener('click', () => openModal(btn));
    });

    const now = new Date();
    LAST_UPDATE.textContent = now.toLocaleString('es-ES');
}

function handleError(error) {
    console.error('Error al cargar noticias:', error);
    LOADING.style.display = 'none';
    let errorText = 'Error al cargar noticias.';
    
    if (error.message.includes('429')) {
        errorText = 'Límite de solicitudes alcanzado. Espera un momento.';
    } else if (error.message.includes('403')) {
        errorText = 'API key inválida.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
        errorText = 'Error de conexión. Verifica tu conexión a internet.';
    } else if (error.message) {
        errorText = `Error: ${error.message}`;
    }
    
    ERROR_MESSAGE.querySelector('p').textContent = errorText;
    ERROR_MESSAGE.style.display = 'block';
}

async function loadNewsFromAPI(apiKey, category = 'general', page = 1, append = false) {
    if (!apiKey || !apiKey.trim()) {
        handleError(new Error('Ingresa una API key de GNews.io'));
        return;
    }

    if (!append) {
        LOADING.style.display = 'flex';
        currentPage = 1;
    } else {
        isLoadingMore = true;
        LOAD_MORE_BTN.textContent = 'Cargando...';
        LOAD_MORE_BTN.disabled = true;
    }
    
    ERROR_MESSAGE.style.display = 'none';

    const params = new URLSearchParams({
        q: category,
        lang: 'es',
        country: 'mx',
        max: 10,
        page: page,
        apikey: apiKey.trim()
    });

    try {
        const response = await fetch(`${GNEWS_SEARCH_URL}?${params}`);
        
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('API key inválida. Verifica tu clave en gnews.io');
            }
            if (response.status === 429) {
                throw new Error('429');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        LOADING.style.display = 'none';
        isLoadingMore = false;
        LOAD_MORE_BTN.textContent = 'Cargar más';
        LOAD_MORE_BTN.disabled = false;
        
        if (data.articles && data.articles.length > 0) {
            const existingUrls = new Set(allArticles.map(a => a.url));
            const newArticles = data.articles.filter(article => !existingUrls.has(article.url));
            
            if (newArticles.length > 0) {
                renderNews(newArticles, append);
            }
            
            if (newArticles.length >= 10) {
                LOAD_MORE_CONTAINER.style.display = 'block';
            } else {
                LOAD_MORE_CONTAINER.style.display = 'none';
            }
        } else {
            if (!append) {
                ERROR_MESSAGE.querySelector('p').textContent = 'No se encontraron noticias en esta categoría.';
                ERROR_MESSAGE.style.display = 'block';
            }
            LOAD_MORE_CONTAINER.style.display = 'none';
        }
        
    } catch (error) {
        handleError(error);
        isLoadingMore = false;
        LOAD_MORE_BTN.textContent = 'Cargar más';
        LOAD_MORE_BTN.disabled = false;
    }
}

function loadNewsFromJSON() {
    LOADING.style.display = 'flex';
    ERROR_MESSAGE.style.display = 'none';

    fetch('./noticias.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            LOADING.style.display = 'none';
            renderNews(data);
        })
        .catch(error => handleError(error));
}

function selectCategory(category, btn) {
    currentCategory = category;
    isSearchMode = false;
    currentSearchQuery = '';
    
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    const dropdown = document.getElementById('category-dropdown');
    if (dropdown) dropdown.classList.remove('open');
    
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchInfo = document.getElementById('search-info');
    
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    if (searchInfo) searchInfo.style.display = 'none';
    
    currentPage = 1;
    loadNewsFromAPI(API_KEY, category, 1, false);
}

function performSearch() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput?.value.trim();
    
    if (!query) return;
    
    isSearchMode = true;
    currentSearchQuery = query;
    
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchInfo = document.getElementById('search-info');
    
    if (clearSearchBtn) clearSearchBtn.style.display = 'inline-block';
    if (searchInfo) {
        searchInfo.textContent = `Resultados para: "${query}"`;
        searchInfo.style.display = 'block';
    }
    
    const dropdown = document.getElementById('category-dropdown');
    if (dropdown) dropdown.classList.remove('open');
    
    currentPage = 1;
    loadNewsFromAPI(API_KEY, query, 1, false);
}

function clearSearch() {
    isSearchMode = false;
    currentSearchQuery = '';
    
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchInfo = document.getElementById('search-info');
    
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    if (searchInfo) searchInfo.style.display = 'none';
    
    selectCategory('general', document.querySelector('.category-btn[data-category="general"]'));
}

function initLoadMoreButton() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            if (!isLoadingMore) {
                currentPage++;
                loadNewsFromAPI(API_KEY, currentCategory, currentPage, true);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const dropdown = document.getElementById('category-dropdown');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    menuToggle?.addEventListener('click', () => {
        dropdown.classList.toggle('open');
    });

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectCategory(btn.dataset.category, btn);
        });
    });

    searchBtn?.addEventListener('click', performSearch);
    
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    clearSearchBtn?.addEventListener('click', clearSearch);

    initLoadMoreButton();

    if (API_KEY) {
        loadNewsFromAPI(API_KEY, currentCategory, 1, false);
    } else {
        loadNewsFromJSON();
    }
});
