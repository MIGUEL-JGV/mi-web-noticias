const NEWS_GRID = document.getElementById('news-grid');
const LOADING = document.getElementById('loading');
const ERROR_MESSAGE = document.getElementById('error-message');
const LAST_UPDATE = document.getElementById('last-update');
const LOAD_MORE_BTN = document.getElementById('load-more-btn');
const LOAD_MORE_CONTAINER = document.getElementById('load-more-container');
const BACK_TO_TOP_BTN = document.getElementById('back-to-top');
const THEME_TOGGLE = document.getElementById('theme-toggle');
const THEME_ICON = document.getElementById('theme-icon');

const GNEWS_SEARCH_URL = 'https://gnews.io/api/v4/search';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const API_KEY = 'YOUR_API_KEY_HERE';

const STORAGE_KEY = 'news_cache';
const FAVORITES_KEY = 'news_favorites';
const THEME_KEY = 'news_theme';
const CACHE_DURATION = 5 * 60 * 1000;

let currentCategory = 'general';
let allArticles = [];
let currentPage = 1;
let isLoadingMore = false;
let isSearchMode = false;
let currentSearchQuery = '';
let currentArticleUrl = '';
let searchTimeout;

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

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        THEME_ICON.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    } else if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        THEME_ICON.textContent = '☀️';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    THEME_ICON.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function initBackToTop() {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            BACK_TO_TOP_BTN.classList.add('visible');
        } else {
            BACK_TO_TOP_BTN.classList.remove('visible');
        }
    });
    
    BACK_TO_TOP_BTN?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function getFavorites() {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
}

function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function isFavorite(url) {
    const favorites = getFavorites();
    return favorites.some(f => f.url === url);
}

function toggleFavorite(article) {
    const favorites = getFavorites();
    const index = favorites.findIndex(f => f.url === article.url);
    const favoriteBtn = document.getElementById('favorite-btn');
    const favoriteIcon = document.getElementById('favorite-icon');
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('Eliminado de favoritos', 'info');
        favoriteBtn?.classList.remove('active');
        favoriteIcon.textContent = '🤍';
    } else {
        favorites.push(article);
        showToast('Agregado a favoritos', 'success');
        favoriteBtn?.classList.add('active');
        favoriteIcon.textContent = '❤️';
    }
    
    saveFavorites(favorites);
    renderFavoritesList();
}

function renderFavoritesList() {
    const list = document.getElementById('favorites-list');
    const favorites = getFavorites();
    
    if (favorites.length === 0) {
        list.innerHTML = '<p class="favorites-panel__empty">No tienes favoritos guardados</p>';
        return;
    }
    
    list.innerHTML = favorites.map(fav => `
        <div class="favorites-panel__item" data-url="${encodeURIComponent(fav.url)}" data-title="${encodeURIComponent(fav.title)}" data-description="${encodeURIComponent(fav.description || '')}" data-image="${encodeURIComponent(fav.image || '')}" data-source="${encodeURIComponent(fav.source || '')}" data-published="${encodeURIComponent(fav.publishedAt || '')}">
            <img src="${fav.image || 'https://via.placeholder.com/80x60'}" alt="${fav.title}">
            <div class="favorites-panel__item-info">
                <h4>${fav.title}</h4>
                <span>${fav.source || 'Fuente unknown'}</span>
            </div>
        </div>
    `).join('');
    
    list.querySelectorAll('.favorites-panel__item').forEach(item => {
        item.addEventListener('click', () => {
            openFavoriteArticle(item.dataset);
            document.getElementById('favorites-panel').classList.remove('open');
        });
    });
}

function openFavoriteArticle(data) {
    const btn = {
        dataset: {
            title: data.title,
            content: data.description,
            url: data.url,
            source: data.source,
            image: data.image,
            published: data.published
        }
    };
    openModal(btn);
}

function shareArticle(title, url) {
    if (navigator.share) {
        navigator.share({
            title: title,
            url: url
        }).then(() => {
            showToast('Compartido exitosamente', 'success');
        }).catch(() => {
            copyToClipboard(url);
        });
    } else {
        copyToClipboard(url);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Enlace copiado al portapapeles', 'success');
    }).catch(() => {
        showToast('Error al copiar enlace', 'error');
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

    currentArticleUrl = url;
    
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-image').src = image;
    document.getElementById('modal-image').alt = title;
    document.getElementById('modal-source').textContent = source;
    document.getElementById('modal-date').textContent = published;
    document.getElementById('modal-link').href = url;
    
    const favoriteBtn = document.getElementById('favorite-btn');
    const favoriteIcon = document.getElementById('favorite-icon');
    const isFav = isFavorite(url);
    favoriteBtn?.classList.toggle('active', isFav);
    favoriteIcon.textContent = isFav ? '❤️' : '🤍';
    
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
        document.getElementById('modal-content').innerHTML = `<p style="font-style: italic; color: var(--text-light); margin-bottom: 1rem;">📝 Este es un resumen de la noticia. Para leer la versión completa, usa el botón de abajo.</p><p>${content}</p>`;
    }
}

function closeModal() {
    MODAL.style.display = 'none';
    document.body.style.overflow = '';
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

function getCache(category, query) {
    const cacheKey = `${STORAGE_KEY}_${category}_${query || 'default'}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
        }
    }
    return null;
}

function setCache(category, query, data) {
    const cacheKey = `${STORAGE_KEY}_${category}_${query || 'default'}`;
    localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
    }));
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
        LOADING.style.display = 'none';
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
    LOADING.style.display = 'none';
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
        const cached = getCache(currentCategory, isSearchMode ? currentSearchQuery : null);
        if (cached) {
            renderNews(cached, false);
            showToast('Mostrando noticias guardadas. Conéctate a internet para actualizaciones.', 'info');
            return;
        }
        errorText = 'Error de conexión. Verifica tu conexión a internet.';
    } else if (error.message) {
        errorText = `Error: ${error.message}`;
    }
    
    ERROR_MESSAGE.querySelector('p').textContent = errorText;
    ERROR_MESSAGE.style.display = 'block';
}

async function loadNewsFromAPI(apiKey, query = 'general', page = 1, append = false) {
    if (!apiKey || !apiKey.trim()) {
        handleError(new Error('Ingresa una API key de GNews.io'));
        return;
    }

    if (!append) {
        LOADING.style.display = 'flex';
        currentPage = 1;
        const cached = getCache(query, null);
        if (cached && page === 1) {
            renderNews(cached, false);
            return;
        }
    } else {
        isLoadingMore = true;
        LOAD_MORE_BTN.textContent = 'Cargando...';
        LOAD_MORE_BTN.disabled = true;
    }
    
    ERROR_MESSAGE.style.display = 'none';

    const params = new URLSearchParams({
        q: query,
        lang: 'es',
        country: 'mx',
        max: 10,
        page: page,
        apikey: apiKey.trim()
    });

    try {
        const apiUrl = encodeURIComponent(GNEWS_SEARCH_URL + '?' + params);
        const response = await fetch(CORS_PROXY + apiUrl);
        
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
            if (!append && page === 1) {
                setCache(query, null, data.articles);
            }
            
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
                ERROR_MESSAGE.querySelector('p').textContent = 'No se encontraron noticias.';
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
                const query = isSearchMode ? currentSearchQuery : currentCategory;
                loadNewsFromAPI(API_KEY, query, currentPage, true);
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
    const shareBtn = document.getElementById('share-btn');
    const favoriteBtn = document.getElementById('favorite-btn');
    const favoritesToggle = document.getElementById('favorites-toggle');
    const favoritesPanel = document.getElementById('favorites-panel');
    const closeFavorites = document.getElementById('close-favorites');
    const clearFavorites = document.getElementById('clear-favorites');

    initTheme();
    initBackToTop();
    renderFavoritesList();
    
    THEME_TOGGLE?.addEventListener('click', toggleTheme);
    
    menuToggle?.addEventListener('click', () => {
        dropdown.classList.toggle('open');
    });

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectCategory(btn.dataset.category, btn);
        });
    });

    searchBtn?.addEventListener('click', performSearch);
    
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (searchInput.value.trim().length >= 3) {
                performSearch();
            }
        }, 500);
    });
    
    clearSearchBtn?.addEventListener('click', clearSearch);

    shareBtn?.addEventListener('click', () => {
        const title = document.getElementById('modal-title').textContent;
        shareArticle(title, currentArticleUrl);
    });

    favoriteBtn?.addEventListener('click', () => {
        const title = decodeURIComponent(document.querySelector('.read-more-btn[data-url="' + encodeURIComponent(currentArticleUrl) + '"]')?.dataset.title || document.getElementById('modal-title').textContent);
        const article = {
            title: document.getElementById('modal-title').textContent,
            url: currentArticleUrl,
            image: document.getElementById('modal-image').src,
            source: document.getElementById('modal-source').textContent,
            description: document.getElementById('modal-content').textContent.substring(0, 200),
            publishedAt: document.getElementById('modal-date').textContent
        };
        toggleFavorite(article);
    });

    favoritesToggle?.addEventListener('click', () => {
        favoritesPanel.classList.add('open');
    });

    closeFavorites?.addEventListener('click', () => {
        favoritesPanel.classList.remove('open');
    });

    clearFavorites?.addEventListener('click', () => {
        if (confirm('¿Eliminar todos los favoritos?')) {
            saveFavorites([]);
            renderFavoritesList();
            showToast('Favoritos eliminados', 'info');
        }
    });

    initLoadMoreButton();

    if (API_KEY && API_KEY !== 'YOUR_API_KEY_HERE') {
        loadNewsFromAPI(API_KEY, currentCategory, 1, false);
    } else {
        const cached = getCache(currentCategory, null);
        if (cached) {
            renderNews(cached, false);
            showToast('Mostrando noticias guardadas', 'info');
        } else {
            ERROR_MESSAGE.querySelector('p').textContent = 'Configura tu API key para ver noticias.';
            ERROR_MESSAGE.style.display = 'block';
        }
    }
});
