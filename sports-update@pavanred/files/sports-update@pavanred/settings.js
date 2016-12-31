
const Values = {
	
    //live score updates for sports
    //true or false
    
	//Cricket
	cricket_international_updates:true,		
	cricket_india_updates:true,			//Indian Premier League
	cricket_all_updates:false,			//worldwide international, first class, county, college, clubs - men and women
		
    //Football
    football_usa_updates: false,
    football_uk_updates: true,			//Barclays Premier League
    football_international_updates: true,
    football_europe_updates: true,
    
    //Tennis
    tennis_updates: false,				//Updates discontinued
    
    //Motorsports
    motorsports_updates:false,			//Updates discontinued
    
    //Golf
    golf_updates:false,
    
    //Basketball
	basketball_updates: true,  			//NBA - National Basketball Association (USA)
	women_basketball_updates: true,  	//WNBA - Women's National Basketball Association (USA)
	NCAA_basketball: false,   			//NCAA -  National Collegiate Athletic Association - Basketball (USA)	
	
	//Americanfootball	
	americanfootball_updates: true,  	//NFL - National Football League (USA)
	
	//Baseball
	baseball_updates: true,  			//MLB - Major League Baseball (USA)
	
	//Ice hockey
	icehockey_updates: true,  			//NHL - National Hockey League (USA)
	
	
	/*-----------------------------------------------------------*/
	
	
	refresh_interval: 180,				// seconds
	
	display_cancelled: false,			// Display games that are cancelled e.g. [Ice Hockey] Toronto at Detroit (CANCELLED)
	
	display_delayed: false,				// Display games that are delayed 
	
	display_finalscores: false,			/* Persist the display of final scores for a while after the game is complete
										   (till the scores are available in the input stream)
										   e.g Dallas 103  Washington 94 (FINAL)									*/
										
	display_upcoming_schedules: false,  // Display the schedule of upcoming games
	
};
