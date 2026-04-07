class Stock {
    constructor(stockID, tickerSymbol, companyName, currentPrice) {
        this.stockID = stockID;
        this.tickerSymbol = tickerSymbol;
        this.companyName = companyName;
        this.currentPrice = currentPrice;
    }

    getStockID() {
        return this.stockID;
    }
    setStockID(stockID) {
        this.stockID = stockID;
    }
    getTickerSymbol() {
        return this.tickerSymbol;
    }
    setTickerSymbol(tickerSymbol) {
        this.tickerSymbol = tickerSymbol;
    }
    getCompanyName() {
        return this.companyName;
    }
    setCompanyName(companyName) {
        this.companyName = companyName;
    }
    getCurrentPrice() {
        return this.currentPrice;
    }
    setCurrentPrice(currentPrice) {
        this.currentPrice = currentPrice;
    }
}