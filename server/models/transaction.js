class Transaction {
    constructor(transactionID, portfolioID, userID, tickerSymbol, transactionType, quantity, pricePerShare, totalPrice, status){
        this.transactionID = transactionID;
        this.portfolioID = portfolioID;
        this.userID = userID;
        this.tickerSymbol = tickerSymbol;
        this.transactionType = transactionType;
        this.quantity = quantity;
        this.pricePerShare = pricePerShare;
        this.totalPrice = totalPrice;
        this.transactionDate = new Date();
        this.status = status;
    }

    getTransactionID() {
        return this.transactionID;
    }
    setTransactionID(transactionID) {
        this.transactionID = transactionID;
    }
    getPortfolioID() {
        return this.portfolioID;
    }
    setPortfolioID(portfolioID) {
        this.portfolioID = portfolioID;
    }
    getUserID() {
        return this.userID;
    }
    setUserID(userID) {
        this.userID = userID;
    }
    getTickerSymbol() {
        return this.tickerSymbol;
    }
    setTickerSymbol(tickerSymbol) {
        this.tickerSymbol = tickerSymbol;
    }
    getTransactionType() {
        return this.transactionType;
    }
    setTransactionType(transactionType) {
        this.transactionType = transactionType;
    }
    getQuantity() {
        return this.quantity;
    }
    setQuantity(quantity) {
        this.quantity = quantity;
    }
    getPricePerShare() {
        return this.pricePerShare;
    }
    setPricePerShare(pricePerShare) {
        this.pricePerShare = pricePerShare;
    }
    getTotalPrice() {
        return this.totalPrice;
    }
    setTotalPrice(totalPrice) {
        this.totalPrice = totalPrice;
    }
    getTransactionDate() {
        return this.transactionDate;
    }
    getStatus() {
        return this.status;
    }
    setStatus(status) {
        this.status = status;
    }
}