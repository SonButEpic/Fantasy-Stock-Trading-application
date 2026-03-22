USE trade_db;
CREATE TABLE User (
    userID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL
);

CREATE TABLE League (
    leagueID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    leagueName VARCHAR(100),
    leagueType ENUM('Open', 'Private'),
    maxPlayers INT CHECK (maxPlayers >= 4 AND maxPlayers <= 20),
    startDate DATE,
    endDate DATE,
    leagueManagerID INT,
    FOREIGN KEY (leagueManagerID) REFERENCES User(userID)
);

CREATE TABLE Portfolio (
    portfolioID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userID INT,
    leagueID INT,
    cashBalance FLOAT,
    portfolioType VARCHAR(50),
    createdDate DATE,
    FOREIGN KEY (userID) REFERENCES User(userID),
    FOREIGN KEY (leagueID) REFERENCES League(leagueID)
);

CREATE TABLE Stock (
    stockID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tickerSymbol VARCHAR(10),
    companyName VARCHAR(100),
    currentPrice FLOAT,
    sector VARCHAR(50)
);

CREATE TABLE Holding (
    holdingID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    userID INT,
    portfolioID INT,
    leagueID INT,
    tickerSymbol VARCHAR(10),
    quantity INT,
    purchasePrice FLOAT,
    FOREIGN KEY (userID) REFERENCES User(userID),
    FOREIGN KEY (portfolioID) REFERENCES Portfolio(portfolioID),
    FOREIGN KEY (leagueID) REFERENCES League(leagueID)
);

CREATE TABLE Transaction (
    transactionID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    portfolioID INT,
    userID INT,
    tickerSymbol VARCHAR(10),
    transactionType ENUM('Buy', 'Sell'),
    quantity INT,
    pricePerShare FLOAT,
    totalPrice FLOAT,
    transactionDate DATE,
    status BOOLEAN,
    FOREIGN KEY (portfolioID) REFERENCES Portfolio(portfolioID),
    FOREIGN KEY (userID) REFERENCES User(userID)
);