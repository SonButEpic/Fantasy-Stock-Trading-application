class Holding {
    constructor(holdingID, userID, portfolioID, leagueID, tickerSymbol, quantity, purchasePrice) {
        this.holdingID = holdingID;
        this.userID = userID;
        this.portfolioID = portfolioID;
        this.leagueID = leagueID;
        this.tickerSymbol = tickerSymbol;
        this.quantity = quantity;
        this.purchasePrice = purchasePrice;
    }

    getHoldingID() {
        return this.holdingID;
    }
    setHoldingID(holdingID) {
        this.holdingID = holdingID;
    }
    getUserID() {
        return this.userID;
    }
    setUserID(userID) {
        this.userID = userID;
    }
    getPortfolioID() {
        return this.portfolioID;
    }
    setPortfolioID(portfolioID) {
        this.portfolioID = portfolioID;
    }
    getLeagueID() {
        return this.leagueID;
    }
    setLeagueID(leagueID) {
        this.leagueID = leagueID;
    }
    getTickerSymbol() {
        return this.tickerSymbol;
    }
    setTickerSymbol(tickerSymbol) {
        this.tickerSymbol = tickerSymbol;
    }
    getQuantity() {
        return this.quantity;
    }
    setQuantity(quantity) {
        this.quantity = quantity;
    }
    getPurchasePrice() {
        return this.purchasePrice;
    }
    setPurchasePrice(purchasePrice) {
        this.purchasePrice = purchasePrice;
    }

}