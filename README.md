# Web2Text Lead Processor

## Local Setup
1. Follow the instructions [here](https://docs.restate.dev/develop/local_dev) to install the Restate Server and Restate CLI
2. Run the restate server
```
mkdir restate-dev
cd restate-dev
restate-server
``` 
3. Clone the repository and run `install` (e.g. `pnpm install`)
4. Run `app-dev` (e.g. `pnpm app-dev`)
5. Open a new terminal window and type
```
restate dep register localhost:9075
```
6. The lead processing endpoints should show up, confirm the registration
7. The endpoints are now available at `localhost:8080/Lead/{endpoint}` - query them with postman to test

## Edge Cases
Q. User submits two leads with the same phone number, dealer ID, and location ID
A. Web2Text will say a lead already exists and merge the leads

Q. User submits two leads with the same phone number, dealer ID, but different location IDs
A. Web2Text will create two leads and two Twilio conversations
> Each location has its own Twilio phone number

Q. A retailer has two locations, both have the same phone number assigned to them. One user submits a lead to one location, and another submits it to the other location
A. Web2Text will create two leads and two Twilio conversations
> Each location has its own Twilio phone number