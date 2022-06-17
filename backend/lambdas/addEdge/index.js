/**
 * The following is the Lambda function set-up for the Gremlin-Lambda combination,
 * as recommended by AWS Documentation: https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions-examples.html
 * All changes involving interaction with gremlin should be done in the query async method.
 */

/*
* POST Request
* Required in request body:
* - from: Node id of source node, formatted as "node-x" where x is the node->id
* - to: Node id of target node, formatted as "node-x" where x is the node->id
*/

const gremlin = require('gremlin');
const async = require('async');
const {initDB,errorHandler} = require('/opt/databaseInit');
const t = gremlin.process.t;
const __ = gremlin.process.statics;

let {g,conn} = initDB(process.env);

async function query(from,to) {
  var result = g.addE('connected_to').from_(__.V(from)).to(__.V(to)).next();
  return result;
}

async function doQuery(from,to) {
  if(from && to){
    let result = await query(from,to);
    return result['value'];
  }
  return;
}


exports.handler = async (event, context) => {

  return async.retry(
    { 
      times: 5,
      interval: 1000,
      errorFilter: function (err) { 
        errorHandler(err,process.env);
      }

    }, 
    async ()=>{
      var request = JSON.parse(event.body);
      console.log(request);
      var result = await doQuery(request.from,request.to);
      if(result){
          return {
            statusCode: 200,
            body: JSON.stringify(result)
          };
      }
      return {
        statusCode: 400,
        body: JSON.stringify("Bad request")
      }
    })
};