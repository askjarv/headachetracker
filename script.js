class HeadacheTracker {
    constructor() {
        this.data = this.loadData();
        this.initializeFormToggle();
        this.initializeForm();
        this.initializeCharts();
        this.initializeImportExport();
        this.initializeDragAndDrop();
        this.restoreChartOrder();
    }

    loadData() {
        try {
            const cookieData = document.cookie
                .split('; ')
                .find(row => row.startsWith('headacheData='));
            
            if (!cookieData) {
                console.log('No existing data found, starting fresh');
                return [];
            }

            const data = JSON.parse(decodeURIComponent(cookieData.split('=')[1]));
            
            // Verify data integrity
            if (!Array.isArray(data)) {
                console.warn('Invalid data format in cookie, starting fresh');
                return [];
            }

            console.log(`Loaded ${data.length} entries from cookie`);
            return data;
        } catch (error) {
            console.error('Error loading data from cookie:', error);
            return [];
        }
    }

    saveData() {
        try {
            // Set cookie to expire in 1 year
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            
            // Ensure data is valid before saving
            if (!Array.isArray(this.data)) {
                throw new Error('Invalid data format');
            }

            const cookieValue = encodeURIComponent(JSON.stringify(this.data));
            document.cookie = `headacheData=${cookieValue}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict`;
            
            console.log(`Saved ${this.data.length} entries to cookie`);
        } catch (error) {
            console.error('Error saving data to cookie:', error);
            alert('There was an error saving your data. Please export your data to CSV as a backup.');
        }
    }

    initializeForm() {
        const form = document.getElementById('headacheForm');
        const intensityInput = document.getElementById('intensity');
        const intensityValue = document.getElementById('intensityValue');

        intensityInput.addEventListener('input', () => {
            intensityValue.textContent = intensityInput.value;
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addEntry();
        });
    }

    addEntry() {
        const entry = {
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            intensity: document.getElementById('intensity').value ? parseInt(document.getElementById('intensity').value) : null,
            water: document.getElementById('water').value ? parseInt(document.getElementById('water').value) : null,
            computerTime: document.getElementById('computerTime').value ? parseFloat(document.getElementById('computerTime').value) : null,
            inOffice: document.getElementById('inOffice').checked,
            notes: document.getElementById('notes').value
        };

        this.data.push(entry);
        this.saveData();
        this.updateCharts();
        document.getElementById('headacheForm').reset();
        
        // Set default values after reset
        document.getElementById('intensity').value = 5;
        document.getElementById('intensityValue').textContent = '5';
    }

    initializeCharts() {
        const chartConfigs = {
            intensity: {
                label: 'Headache Intensity',
                color: 'rgb(255, 99, 132)',
                elementId: 'intensityChart'
            },
            water: {
                label: 'Water Intake',
                color: 'rgb(54, 162, 235)',
                elementId: 'waterChart'
            },
            computerTime: {
                label: 'Screen Time',
                color: 'rgb(75, 192, 192)',
                elementId: 'computerTimeChart'
            },
            inOffice: {
                label: 'In Office',
                color: 'rgb(153, 102, 255)',
                elementId: 'inOfficeChart'
            }
        };

        this.charts = {};
        
        for (const [key, config] of Object.entries(chartConfigs)) {
            const ctx = document.getElementById(config.elementId).getContext('2d');
            this.charts[key] = new Chart(ctx, {
                type: key === 'inOffice' ? 'bar' : 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: config.label,
                        borderColor: config.color,
                        backgroundColor: config.color + '40',
                        data: [],
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day',
                                displayFormats: {
                                    day: 'MMM d'
                                }
                            },
                            min: this.getDateXDaysAgo(31),
                            max: new Date()
                        },
                        y: {
                            beginAtZero: true,
                            ...(key === 'inOffice' ? {
                                ticks: {
                                    callback: function(value) {
                                        return value === 1 ? 'Yes' : 'No';
                                    },
                                    stepSize: 1,
                                    max: 1,
                                    min: 0
                                }
                            } : {})
                        }
                    },
                    plugins: {
                        tooltip: {
                            ...(key === 'inOffice' ? {
                                callbacks: {
                                    label: function(context) {
                                        return `In Office: ${context.raw === 1 ? 'Yes' : 'No'}`;
                                    }
                                }
                            } : {})
                        }
                    }
                }
            });
        }
        
        this.updateCharts();
    }

    getDateXDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    }

    updateCharts() {
        const sortedData = [...this.data].sort((a, b) => new Date(a.date) - new Date(b.date));
        const last31Days = this.getLast31DaysArray();
        
        for (const [key, chart] of Object.entries(this.charts)) {
            const dataMap = new Map(
                sortedData.map(entry => [entry.date, entry[key]])
            );
            
            const data = last31Days.map(date => {
                const dateStr = date.toISOString().split('T')[0];
                return dataMap.get(dateStr) ?? null;
            });

            chart.data.labels = last31Days;
            chart.data.datasets[0].data = data;
            
            chart.options.scales.x.min = this.getDateXDaysAgo(31);
            chart.options.scales.x.max = new Date();
            
            chart.update();
        }
    }

    getLast31DaysArray() {
        const dates = [];
        for (let i = 31; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date);
        }
        return dates;
    }

    initializeImportExport() {
        document.getElementById('exportBtn').addEventListener('click', () => this.exportToCsv());
        document.getElementById('importFile').addEventListener('change', (e) => this.importFromCsv(e));
    }

    exportToCsv() {
        try {
            // Check if there's data to export
            if (!this.data || this.data.length === 0) {
                alert('No data to export');
                return;
            }

            const headers = ['date', 'time', 'intensity', 'water', 'computerTime', 'inOffice', 'notes'];
            const csvRows = [headers];

            for (const entry of this.data) {
                const row = headers.map(header => {
                    const value = entry[header];
                    // Handle null values and proper CSV escaping
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                csvRows.push(row);
            }

            const csvContent = 'data:text/csv;charset=utf-8,' + 
                csvRows.map(row => row.join(',')).join('\n');

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `headache-tracker-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('CSV export completed');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Error exporting data. Please try again.');
        }
    }

    importFromCsv(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvData = event.target.result;
            const rows = csvData.split('\n');
            const headers = rows[0].split(',');

            this.data = rows.slice(1).map(row => {
                const values = row.split(',');
                const entry = {};
                headers.forEach((header, index) => {
                    let value = values[index];
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    else if (!isNaN(value)) value = Number(value);
                    entry[header.trim()] = value;
                });
                return entry;
            });

            this.saveData();
            this.updateCharts();
        };
        reader.readAsText(file);
    }

    initializeDragAndDrop() {
        const cards = document.querySelectorAll('.chart-card');
        const chartsGrid = document.querySelector('.charts-grid');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.dataset.chartType);
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                document.querySelectorAll('.chart-card').forEach(card => {
                    card.classList.remove('drag-over');
                });
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                card.classList.add('drag-over');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedType = e.dataTransfer.getData('text/plain');
                const draggedCard = document.querySelector(`[data-chart-type="${draggedType}"]`);
                const dropTarget = card;

                if (draggedCard !== dropTarget) {
                    const allCards = [...chartsGrid.children];
                    const draggedIndex = allCards.indexOf(draggedCard);
                    const dropIndex = allCards.indexOf(dropTarget);

                    if (draggedIndex < dropIndex) {
                        dropTarget.parentNode.insertBefore(draggedCard, dropTarget.nextSibling);
                    } else {
                        dropTarget.parentNode.insertBefore(draggedCard, dropTarget);
                    }

                    // Save the new order
                    this.saveChartOrder();
                }
            });
        });
    }

    saveChartOrder() {
        const order = [...document.querySelectorAll('.chart-card')]
            .map(card => card.dataset.chartType);
        localStorage.setItem('chartOrder', JSON.stringify(order));
    }

    restoreChartOrder() {
        const savedOrder = localStorage.getItem('chartOrder');
        if (!savedOrder) return;

        try {
            const order = JSON.parse(savedOrder);
            const chartsGrid = document.querySelector('.charts-grid');
            const cards = [...document.querySelectorAll('.chart-card')];

            // Reorder cards according to saved order
            order.forEach(chartType => {
                const card = cards.find(card => card.dataset.chartType === chartType);
                if (card) {
                    chartsGrid.appendChild(card);
                }
            });
        } catch (error) {
            console.error('Error restoring chart order:', error);
        }
    }

    initializeFormToggle() {
        const toggleBtn = document.getElementById('toggleForm');
        const form = document.getElementById('headacheForm');
        const icon = toggleBtn.querySelector('i');
        
        // Restore previous state
        const isCollapsed = localStorage.getItem('formCollapsed') === 'true';
        if (isCollapsed) {
            form.classList.add('collapsed');
            toggleBtn.classList.add('collapsed');
        }

        toggleBtn.addEventListener('click', () => {
            form.classList.toggle('collapsed');
            toggleBtn.classList.toggle('collapsed');
            
            // Save state
            localStorage.setItem('formCollapsed', form.classList.contains('collapsed'));
        });
    }
}

// Initialize the tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new HeadacheTracker();
}); 