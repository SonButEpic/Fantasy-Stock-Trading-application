(function () {
	const USER_KEY = 'fantastock_currentUser';
	let selectedTicker = '';
	let selectedCompany = '';
	let selectedPrice;

	function formatCurrency(value) {
		return new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: 'CAD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(Number(value) || 0);
	}

	function setTradeMessage(message, isError) {
		const messageEl = document.getElementById('tradeMessage');
		if (!messageEl) {
			return;
		}

		if (!message) {
			messageEl.style.display = 'none';
			messageEl.textContent = '';
			messageEl.classList.remove('success', 'error');
			return;
		}

		messageEl.textContent = message;
		messageEl.style.display = 'block';
		messageEl.classList.remove('success', 'error');
		messageEl.classList.add(isError ? 'error' : 'success');
	}

	function initializeTickerContext() {
		const params = new URLSearchParams(window.location.search);
		const queryTicker = (params.get('ticker') || '').trim().toUpperCase();
		const queryCompany = (params.get('company') || '').trim();
		const queryPrice = Number(params.get('price'));

		if (queryTicker) {
			selectedTicker = queryTicker;
		}
		if (queryCompany) {
			selectedCompany = queryCompany;
		}
		if (Number.isFinite(queryPrice) && queryPrice > 0) {
			selectedPrice = queryPrice;
		}

		const tickerSymbolHeading = document.getElementById('tickerSymbolHeading');
		const companyNameHeading = document.getElementById('companyNameHeading');
		const currentPriceHeading = document.getElementById('currentPriceHeading');
		const tradeHeader = document.getElementById('tradeHeader');

		if (tickerSymbolHeading) {
			tickerSymbolHeading.textContent = selectedTicker;
		}
		if (companyNameHeading) {
			companyNameHeading.textContent = selectedCompany;
		}
		if (currentPriceHeading) {
			currentPriceHeading.textContent = formatCurrency(selectedPrice);
		}
		if (tradeHeader) {
			tradeHeader.textContent = `Trade ${selectedTicker}`;
		}
	}

	async function submitTrade(tradeType) {
		setTradeMessage('', false);

		const username = localStorage.getItem(USER_KEY);
		if (!username) {
			setTradeMessage('Please log in before placing a trade.', true);
			return;
		}

		const quantityInput = document.getElementById('tradeQuantity');
		const quantity = Number(quantityInput && quantityInput.value);

		if (!Number.isInteger(quantity) || quantity <= 0) {
			setTradeMessage('Please enter a valid whole-number quantity.', true);
			return;
		}

		const buyButton = document.getElementById('buyButton');
		const sellButton = document.getElementById('sellButton');
		if (buyButton) buyButton.disabled = true;
		if (sellButton) sellButton.disabled = true;

		try {
			const response = await fetch('/api/trades', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					username,
					tickerSymbol: selectedTicker,
					tradeType,
					quantity,
					pricePerShare: selectedPrice,
				}),
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Unable to process trade.');
			}

			setTradeMessage(result.message || 'Trade executed successfully.', false);
			if (quantityInput) {
				quantityInput.value = '';
			}

			window.setTimeout(function () {
				window.location.href = 'portfolioPage.html';
			}, 700);
		} catch (error) {
			setTradeMessage(error.message || 'Unable to process trade.', true);
		} finally {
			if (buyButton) buyButton.disabled = false;
			if (sellButton) sellButton.disabled = false;
		}
	}

	window.submitTrade = submitTrade;

	if (document.readyState === 'loading') {
		window.addEventListener('DOMContentLoaded', initializeTickerContext);
	} else {
		initializeTickerContext();
	}
})();
