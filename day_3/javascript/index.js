let bank_balance = 10000;
const fuliza_limit = 300;

const can_fuliza = (amount) =>{
    if (amount > fuliza_limit) {
        return "I am sorry, you can not fuliza"
    } else {
        return "you can fuliza"
    }
}

console.log('Hello John, ${can_fuliza(1000))}');
