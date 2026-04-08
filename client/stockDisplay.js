async function loadChart() {
    const response = await fetch(`/api/stock-history/${symbol}`);
    const data = await response.json();

    if (data.error) {
        console.error(data.error);
        return;
    }

    // Alpha Vantage nesting: "Time Series (Daily)" -> "YYYY-MM-DD" -> "4. close"
    const timeSeries = data["Time Series (Daily)"];
    const dates = Object.keys(timeSeries).reverse(); // Dates for X-axis
    const prices = dates.map(date => parseFloat(timeSeries[date]["4. close"])); // Prices for Y-axis

    const ctx = document.getElementById('stockChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: `${symbol} Price`,
                data: prices,
                borderColor: '#3a86ff',
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}