// Receptkönyv PWA - Fő alkalmazás
const { useState, useEffect, useCallback } = React;

// Típusok
interface Recipe {
    id: number;
    title: string;
    category: string;
    ingredients: string;
    instructions: string;
    createdAt: string;
}

interface Category {
    name: string;
    count: number;
}

// Fő alkalmazás komponens
function ReceptkonyvApp() {
    // State kezelés
    const [recipes, setRecipes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [currentView, setCurrentView] = useState('list');
    const [selectedCategory, setSelectedCategory] = useState('mind');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [db, setDb] = useState(null);

    // SQL.js inicializálás
    useEffect(() => {
        const initDB = async () => {
            try {
                // SQL.js betöltése
                const SQL = await window.initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
                });

                // Adatbázis létrehozása vagy betöltése
                let database;
                const savedData = localStorage.getItem('receptkonyv-db');
                
                if (savedData) {
                    const data = new Uint8Array(JSON.parse(savedData));
                    database = new SQL.Database(data);
                } else {
                    database = new SQL.Database();
                    // Táblák létrehozása
                    database.run(`
                        CREATE TABLE IF NOT EXISTS recipes (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            title TEXT NOT NULL,
                            category TEXT NOT NULL,
                            ingredients TEXT NOT NULL,
                            instructions TEXT NOT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    
                    // Példa receptek hozzáadása
                    database.run(`
                        INSERT INTO recipes (title, category, ingredients, instructions) VALUES
                        ('Gulyásleves', 'Főétel', 'marha, burgonya, hagyma, paprika, paradicsom', 'A húst felkockázzuk, a hagymát megdinszteljük...'),
                        ('Palacsinta', 'Desszert', 'liszt, tojás, tej, cukor, só', 'A lisztet elkeverjük a tojással és a tejjel...'),
                        ('Rántotta', 'Reggeli', 'tojás, só, bors, vaj', 'A tojásokat felverjük, sózzuk, borsozzuk...')
                    `);
                }

                setDb(database);
                loadRecipes(database);
                setLoading(false);
            } catch (error) {
                console.error('Adatbázis inicializálás hiba:', error);
                setMessage('Hiba történt az adatbázis betöltésekor');
                setLoading(false);
            }
        };

        initDB();
    }, []);

    // Adatbázis mentése localStorage-ba
    const saveDB = useCallback((database) => {
        try {
            const data = database.export();
            const buffer = Array.from(data);
            localStorage.setItem('receptkonyv-db', JSON.stringify(buffer));
        } catch (error) {
            console.error('Adatbázis mentés hiba:', error);
        }
    }, []);

    // Receptek betöltése
    const loadRecipes = useCallback((database) => {
        try {
            const stmt = database.prepare('SELECT * FROM recipes ORDER BY created_at DESC');
            const recipesData = [];
            
            while (stmt.step()) {
                const row = stmt.getAsObject();
                recipesData.push({
                    id: row.id,
                    title: row.title,
                    category: row.category,
                    ingredients: row.ingredients,
                    instructions: row.instructions,
                    createdAt: row.created_at
                });
            }
            
            stmt.free();
            setRecipes(recipesData);
            
            // Kategóriák számolása
            const categoryCount = {};
            recipesData.forEach(recipe => {
                categoryCount[recipe.category] = (categoryCount[recipe.category] || 0) + 1;
            });
            
            const categoriesData = Object.entries(categoryCount).map(([name, count]) => ({
                name,
                count
            }));
            
            setCategories(categoriesData);
        } catch (error) {
            console.error('Receptek betöltése hiba:', error);
            setMessage('Hiba történt a receptek betöltésekor');
        }
    }, []);

    // Recept hozzáadása vagy szerkesztése
    const saveRecipe = useCallback((recipeData) => {
        if (!db) return;

        try {
            if (editingRecipe) {
                // Szerkesztés
                db.run(
                    'UPDATE recipes SET title = ?, category = ?, ingredients = ?, instructions = ? WHERE id = ?',
                    [recipeData.title, recipeData.category, recipeData.ingredients, recipeData.instructions, editingRecipe.id]
                );
                setMessage('Recept sikeresen frissítve!');
            } else {
                // Új recept
                db.run(
                    'INSERT INTO recipes (title, category, ingredients, instructions) VALUES (?, ?, ?, ?)',
                    [recipeData.title, recipeData.category, recipeData.ingredients, recipeData.instructions]
                );
                setMessage('Recept sikeresen hozzáadva!');
            }
            
            saveDB(db);
            loadRecipes(db);
            setCurrentView('list');
            setEditingRecipe(null);
            
            // Üzenet eltüntetése 3 másodperc után
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Recept mentés hiba:', error);
            setMessage('Hiba történt a recept mentésekor');
        }
    }, [db, editingRecipe, saveDB, loadRecipes]);

    // Recept törlése
    const deleteRecipe = useCallback((id) => {
        if (!db) return;
        
        if (confirm('Biztosan törölni szeretnéd ezt a receptet?')) {
            try {
                db.run('DELETE FROM recipes WHERE id = ?', [id]);
                saveDB(db);
                loadRecipes(db);
                setMessage('Recept sikeresen törölve!');
                setTimeout(() => setMessage(''), 3000);
            } catch (error) {
                console.error('Recept törlés hiba:', error);
                setMessage('Hiba történt a recept törlésekor');
            }
        }
    }, [db, saveDB, loadRecipes]);

    // Szűrt receptek
    const filteredRecipes = recipes.filter(recipe => {
        const matchesCategory = selectedCategory === 'mind' || recipe.category === selectedCategory;
        const matchesSearch = recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             recipe.ingredients.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Loading állapot
    if (loading) {
        return (
            React.createElement('div', { className: 'loading' },
                React.createElement('div', { className: 'spinner' })
            )
        );
    }

    return (
        React.createElement('div', { className: 'app' },
            // Fejléc
            React.createElement('header', { className: 'header' },
                React.createElement('h1', null, '🍽️ Receptkönyv')
            ),
            
            // Navigáció
            React.createElement('nav', { className: 'nav' },
                React.createElement('button', {
                    className: `nav-button ${currentView === 'list' ? 'active' : ''}`,
                    onClick: () => setCurrentView('list')
                }, 'Receptek'),
                React.createElement('button', {
                    className: `nav-button ${currentView === 'add' ? 'active' : ''}`,
                    onClick: () => {
                        setCurrentView('add');
                        setEditingRecipe(null);
                    }
                }, 'Új recept'),
                React.createElement('button', {
                    className: `nav-button ${currentView === 'categories' ? 'active' : ''}`,
                    onClick: () => setCurrentView('categories')
                }, 'Kategóriák')
            ),
            
            // Üzenetek
            message && React.createElement('div', { 
                className: `message ${message.includes('hiba') || message.includes('Hiba') ? 'message-error' : 'message-success'}` 
            }, message),
            
            // Fő tartalom
            React.createElement('main', { className: 'main-content' },
                currentView === 'list' && React.createElement(RecipeList, {
                    recipes: filteredRecipes,
                    categories: categories,
                    selectedCategory: selectedCategory,
                    onCategoryChange: setSelectedCategory,
                    searchTerm: searchTerm,
                    onSearchChange: setSearchTerm,
                    onEdit: (recipe) => {
                        setEditingRecipe(recipe);
                        setCurrentView('add');
                    },
                    onDelete: deleteRecipe
                }),
                
                currentView === 'add' && React.createElement(RecipeForm, {
                    recipe: editingRecipe,
                    onSave: saveRecipe,
                    onCancel: () => {
                        setCurrentView('list');
                        setEditingRecipe(null);
                    }
                }),
                
                currentView === 'categories' && React.createElement(CategoryList, {
                    categories: categories
                })
            ),
            
            // PWA telepítés gomb
            React.createElement('button', { id: 'install-button' }, 'Telepítés')
        )
    );
}

// Receptek lista komponens
function RecipeList({ recipes, categories, selectedCategory, onCategoryChange, searchTerm, onSearchChange, onEdit, onDelete }) {
    return (
        React.createElement('div', null,
            // Szűrők
            React.createElement('div', { className: 'card' },
                React.createElement('h2', null, 'Szűrők'),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', { className: 'form-label' }, 'Keresés:'),
                    React.createElement('input', {
                        type: 'text',
                        className: 'form-input',
                        placeholder: 'Recept neve vagy hozzávaló...',
                        value: searchTerm,
                        onChange: (e) => onSearchChange(e.target.value)
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', { className: 'form-label' }, 'Kategória:'),
                    React.createElement('select', {
                        className: 'form-input',
                        value: selectedCategory,
                        onChange: (e) => onCategoryChange(e.target.value)
                    },
                        React.createElement('option', { value: 'mind' }, 'Minden kategória'),
                        categories.map(cat => 
                            React.createElement('option', { key: cat.name, value: cat.name }, 
                                `${cat.name} (${cat.count})`
                            )
                        )
                    )
                )
            ),
            
            // Receptek
            React.createElement('div', { className: 'recipe-list' },
                recipes.length === 0 ? (
                    React.createElement('div', { className: 'card' },
                        React.createElement('p', null, 'Nincs találat a megadott szűrőkkel.')
                    )
                ) : (
                    recipes.map(recipe =>
                        React.createElement('div', { key: recipe.id, className: 'recipe-item' },
                            React.createElement('h3', { className: 'recipe-title' }, recipe.title),
                            React.createElement('p', { className: 'recipe-category' }, recipe.category),
                            React.createElement('p', { className: 'recipe-description' }, 
                                recipe.ingredients.substring(0, 100) + (recipe.ingredients.length > 100 ? '...' : '')
                            ),
                            React.createElement('div', { style: { marginTop: '1rem' } },
                                React.createElement('button', {
                                    className: 'btn btn-primary',
                                    onClick: () => onEdit(recipe)
                                }, 'Szerkesztés'),
                                React.createElement('button', {
                                    className: 'btn btn-danger',
                                    onClick: () => onDelete(recipe.id)
                                }, 'Törlés')
                            )
                        )
                    )
                )
            )
        )
    );
}

// Recept űrlap komponens
function RecipeForm({ recipe, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        title: recipe?.title || '',
        category: recipe?.category || '',
        ingredients: recipe?.ingredients || '',
        instructions: recipe?.instructions || ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!formData.title || !formData.category || !formData.ingredients || !formData.instructions) {
            alert('Kérjük, töltse ki az összes mezőt!');
            return;
        }
        
        onSave(formData);
    };

    return (
        React.createElement('div', { className: 'card' },
            React.createElement('h2', null, recipe ? 'Recept szerkesztése' : 'Új recept hozzáadása'),
            React.createElement('form', { onSubmit: handleSubmit },
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', { className: 'form-label' }, 'Recept neve:'),
                    React.createElement('input', {
                        type: 'text',
                        className: 'form-input',
                        value: formData.title,
                        onChange: (e) => setFormData({...formData, title: e.target.value}),
                        placeholder: 'pl. Gulyásleves'
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', { className: 'form-label' }, 'Kategória:'),
                    React.createElement('input', {
                        type: 'text',
                        className: 'form-input',
                        value: formData.category,
                        onChange: (e) => setFormData({...formData, category: e.target.value}),
                        placeholder: 'pl. Főétel, Desszert, Reggeli'
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', { className: 'form-label' }, 'Hozzávalók:'),
                    React.createElement('textarea', {
                        className: 'form-input form-textarea',
                        value: formData.ingredients,
                        onChange: (e) => setFormData({...formData, ingredients: e.target.value}),
                        placeholder: 'Sorolja fel a hozzávalókat...'
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', { className: 'form-label' }, 'Elkészítés:'),
                    React.createElement('textarea', {
                        className: 'form-input form-textarea',
                        value: formData.instructions,
                        onChange: (e) => setFormData({...formData, instructions: e.target.value}),
                        placeholder: 'Írja le az elkészítés lépéseit...'
                    })
                ),
                React.createElement('div', null,
                    React.createElement('button', { type: 'submit', className: 'btn btn-success' }, 
                        recipe ? 'Frissítés' : 'Hozzáadás'
                    ),
                    React.createElement('button', { 
                        type: 'button', 
                        className: 'btn btn-secondary',
                        onClick: onCancel 
                    }, 'Mégse')
                )
            )
        )
    );
}

// Kategóriák lista komponens
function CategoryList({ categories }) {
    return (
        React.createElement('div', { className: 'card' },
            React.createElement('h2', null, 'Kategóriák'),
            categories.length === 0 ? (
                React.createElement('p', null, 'Nincsenek még kategóriák.')
            ) : (
                React.createElement('div', null,
                    categories.map(category =>
                        React.createElement('div', { 
                            key: category.name, 
                            style: { 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                padding: '0.5rem 0',
                                borderBottom: '1px solid #e5e7eb'
                            }
                        },
                            React.createElement('span', null, category.name),
                            React.createElement('span', { 
                                style: { 
                                    background: '#4f46e5', 
                                    color: 'white', 
                                    padding: '0.25rem 0.5rem', 
                                    borderRadius: '0.25rem',
                                    fontSize: '0.875rem'
                                } 
                            }, category.count)
                        )
                    )
                )
            )
        )
    );
}

// Alkalmazás renderelése
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(ReceptkonyvApp));