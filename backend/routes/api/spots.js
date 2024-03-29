const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const  { query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');
const { Spot, Image, User, Review, Booking } = require('../../db/models')

const validateBooking = [
    check("startDate")
      .exists()
      .isISO8601(),
    //   .custom(async (value,{req, location, path} )=>{
    //     const bookings = await Booking.findAll()
    //     bookings.forEach(ele=>{
    //         // console.log(new Date(ele.startDate).toISOString().split('T')[0] === new Date(value).toISOString().split('T')[0],'------------------')
    //         // console.log(new Date(value) >= new Date(ele.startDate),'------------------')
    //         // console.log(new Date(value) <= new Date(ele.endDate),'------------------')
    //         if(!(new Date(ele.startDate).toISOString().split('T')[0] === new Date(value).toISOString().split('T')[0] || (new Date(value) >= new Date(ele.startDate)&& new Date(value) <= new Date(ele.endDate))))return true
    //         else throw new Error("Start date conflicts with an existing booking") 
    //     })
    //   }),
    check("endDate")
    .exists()
    .isISO8601()
    .custom(async (value, {req, location, path})=>{
        if(!(new Date(value) < new Date(req.body.startDate)))return true
        else throw new Error("endDate cannot come before startDate")
    }),
    handleValidationErrors
]

const validateSpots = [
    check('address')
      .exists()
      .withMessage("Street address is required"),
    check('city')
      .exists()
      .withMessage("City is required"),
    check('state')
      .exists()
      .withMessage("State is required"),
    check('country')
      .exists()
      .withMessage("Country is required"),
    check('lat')
      .exists()
      .withMessage("Latitude is not valid"),
    check('lng')
      .exists()
      .withMessage("Longitude is not valid"),
    check('name')
      .exists()
      .withMessage("Name must be less than 50 characters"),
    check('description')
      .exists()
      .withMessage("Description is required"),
    check('price')
      .exists()
      .withMessage("Price per day is required"),
    handleValidationErrors
];


router.post(
    '/',
    validateSpots,
    async (req,res)=>{
        const {address ,city, state, country, lat, lng, name, description, price} = req.body
        const ownerId = req.user.id
        if(!req.user.id){
            return res.json('need to be logged in')
        }
        const spotCheck = await Spot.findOne({
            where:{
                address:req.body.address
            }
        })
        if(spotCheck){
            return res.json({
                message:'address needs to be a unique'
            })
        }
        const spot = await Spot.create({ownerId ,address ,city, state, country, lat, lng, name, description, price})
        const safeSpot = {
            id:spot.id,
            ownerId:spot.ownerId,
            address:spot.address,
            city:spot.city, 
            state:spot.state,
            country:spot.country,
            lat:spot.lat,
            lng:spot.lng,
            name:spot.name, 
            description:spot.description, 
            price:spot.price
        }
        return res.json(safeSpot)
    })
    router.get('/',async (req, res)=>{
        const {page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice} = req.query
        const allSpots = await Spot.findAll()
        res.json({
            spots:allSpots
        })
    })
    router.get('/current',async(req, res)=>{
        const {page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice} = req.query
        const currUser = req.user.id
        const allSpots = await Spot.findAll({
            where:{
                ownerId:currUser
            }
        })
        res.json({
            Spots:allSpots
        })
    })

    router.get('/:spotId/reviews',async (req, res)=>{
        const {page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice} = req.query
        // const spotI = Number(req.params.spotId)
        const reviews = await Review.findAll({
            where:{
                spotId:Number(req.params.spotId)
            },
            include:[{model:Image,as:'ReviewImages'}]
        })
        if(!reviews.length){
            return res.status(404).json({
                "message": "Spot couldn't be found"
              })
        }
        return res.status(200).json({
            reviews
        })
    })
    
    router.post('/:spotId/bookings',
        validateBooking,
        async (req, res)=>{
        const endDate = req.body.endDate
        const startDate = req.body.startDate
        const bookings = await Booking.findAll()
        bookings.forEach(ele=>{
            if(!(new Date(ele.endDate).toISOString().split('T')[0] === new Date(endDate).toISOString().split('T')[0] || (new Date(endDate) <= new Date(ele.endDate)&& new Date(endDate) >= new Date(ele.startDate))))null
            else return res.status(403).json({
                "message": "Sorry, this spot is already booked for the specified dates",
                "errors": {
                  "startDate": "Start date conflicts with an existing booking",
                  "endDate": "End date conflicts with an existing booking"
                }
              })
            
            if(!(new Date(ele.startDate).toISOString().split('T')[0] === new Date(startDate).toISOString().split('T')[0] || (new Date(startDate) >= new Date(ele.startDate)&& new Date(startDate) <= new Date(ele.endDate))))return true
            else return res.status(403).json({
                "message": "Sorry, this spot is already booked for the specified dates",
                "errors": {
                  "startDate": "Start date conflicts with an existing booking",
                  "endDate": "End date conflicts with an existing booking"
                }
              })
        })
        const spotId = req.params.spotId
        const userId = req.user.id
        const spotCheck = await Spot.findByPk(spotId)
        if(!spotCheck){
            return res.status(404).json({
                "message": "Spot couldn't be found"
              })
        }

        if(userId === spotCheck.ownerId)throw new Error('cannot book your own spot')
        const bookingCreated = await Booking.create({spotId, userId, startDate, endDate})
        res.status(200).json(bookingCreated)
    })

    router.get('/:spotId/bookings',async (req, res)=>{
        const {page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice} = req.query
        const spotId = Number(req.params.spotId)
        const currUser = req.user.id
        const spot = await Spot.findByPk(spotId)
        if(!spot){
            return res.status(404).json({
                "message": "Spot couldn't be found"
              })
        }
        const bookings = await Booking.findAll({
            include:{model:User},
            where:{
                spotId: spotId
            },
        })
        console.log(spotId,'--------------------------',currUser)
        if(spotId === req.user.id){
            res.status(200).json({Bookings:bookings})
        }
        const filteredBookings = []
        bookings.forEach(ele=>{
            const filter = {
                spotId:ele.spotId,
                startDate:ele.startDate,
                endDate:ele.endDate
            }
            filteredBookings.push(filter)
        })

        return res.status(200).json({
            Bookings:filteredBookings
        })
    })
    

    router.post('/:spotId/reviews',async (req, res)=>{
        const {review, stars} = req.body;
        const spotId = Number(req.params.spotId)
        const userId = req.user.id
        const spotCheck = await Spot.findByPk(req.params.spotId)
        const userCheck = await User.findByPk(req.user.id,{
            include:{
                model:Review
            }
        })
        if(userCheck.Reviews){
          userCheck.Reviews.forEach(ele => {
            if(ele.spotId === spotId){
                res.status(500).json({
                    "message": "User already has a review for this spot"
                  })
            }
        });  
        }
        
        if(!spotCheck){
            return res.status(404).json({
                "message": "Spot couldn't be found"
              })
        }
        if(review && stars){
           const newReview = await Review.create({userId, spotId, review, stars}) 
           return res.status(201).json(newReview)
        }
    })

    router.post('/:id/images',async (req, res)=>{
        const imageableId = Number(req.params.id)
        const imageableType = 'SpotPics'
        const spotCheck = await Spot.findByPk(imageableId)
        if(!(spotCheck.ownerId === req.user.id)){
            throw new Error('Only owner can add images')
        }
        if(!spotCheck){
            return res.status(404).json({
                "message": "Spot couldn't be found"
            })
        }
        const { url} = req.body
        const previewImage = req.body.preview
        const spotImg = await Image.create({url, previewImage, imageableId, imageableType})
        const sortedImg = {
            id :spotImg.id,
            url:spotImg.url,
            preview:spotImg.previewImage
        }
        res.json(sortedImg)
    })

    router.delete('/:spotId',async (req, res)=>{
        const currUser = req.user.id
        const spot = await Spot.findByPk(Number(req.params.spotId))
        if(!spot)return res.status(404).json({
            "message": "Spot couldn't be found"
          })
 
        if(spot.ownerId === currUser){
            await spot.destroy()
            return res.status(200).json({
                "message": "Successfully deleted"
              })
        }else{
            return res.status(404).json({message:'only owner can delete'})
        }

    })

    router.put('/:spotId',
        validateSpots,
        async (req, res)=>{
        const {address ,city, state, country, lat, lng, name, description, price} = req.body
        const spotId = req.params.spotId
        const spot = await Spot.findByPk(spotId)
        if(!(spot.ownerId === req.user.id)){
            throw new Error('Only owner can add images')
        }
        if(!spot){
            res.status(404).json({
                "message": "Spot couldn't be found"
              })
        }
        if(address){
            spot.address = address
        }
        if(city){
            spot.city = city
        }
        if(state){
            spot.state = state
        }
        if(country){
            spot.country = country
        }
        if(lat){
            spot.lat = lat
        }
        if(lng){
            spot.lng = lng
        }
        if(name){
            spot.name = name
        }
        if(description){
            spot.description = description
        }
        if(price){
            spot.price = price
        }
        return res.json(spot)
    })
    
    router.get('/:spotId',async (req, res)=>{
        const {page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice} = req.query
        const spotId = req.params.spotId
        const spotInfo = await Spot.findByPk(spotId,{
            include:[{model:Image,as:'SpotImages'}, {model:User,as:'Owner'}]
        })
        res.status(200).json({
            spotInfo
        , minLat, maxLat, minLng, maxLng, minPrice, maxPrice})
    })

module.exports = router