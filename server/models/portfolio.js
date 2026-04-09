class Portfolio {
    constructor(portfolioID, userID, leagueID, cashBalance, portfolioType) {
        this.portfolioID = portfolioID;
        this.userID = userID;
        this.leagueID = leagueID;
        this.cashBalance = cashBalance;
        this.portfolioType = portfolioType;
        this.createdDate = new Date();
        this.holdings = [];
        this.transactions = [];
    }

    getPortfolioID() {
        return this.portfolioID;
    }
    setPortfolioID(portfolioId) {
        this.portfolioID = portfolioId;
    }
    getCashBalance() {
        return this.cashBalance;
    }
    setCashBalance(cashBalance) {
        this.cashBalance = cashBalance;
    }
    getPortfolioType() {
        return this.portfolioType;
    }
    setPortfolioType(portfolioType) {
        this.portfolioType = portfolioType;
    }
    getUserID() {
        return this.userID;
    }
    setUserID(userID) {
        this.userID = userID;
    }
    getLeagueID() {
        return this.leagueID;
    }
    setLeagueID(leagueID) {
        this.leagueID = leagueID;
    }

}