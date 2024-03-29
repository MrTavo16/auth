const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
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

router.get('/current',async (req, res)=>{
    const currUser = req.user.id
    const bookings = await Booking.findAll({
        where:{
            userId:currUser
        }
    })
    return res.status(200).json({Bookings:bookings})
})

router.put('/:bookingId',handleValidationErrors,async (req, res)=>{
    const {startDate, endDate} = req.body
    let today = new Date().toISOString().slice(0, 10)
    if(new Date(endDate) < today)return res.status(403).json({
        "message": "Past bookings can't be modified"
    })

    const specBooking = await Booking.findByPk(Number(req.params.bookingId))
    if(!specBooking)return res.status(404).json({
        "message": "Booking couldn't be found"
      })

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
    if(startDate && endDate){
        specBooking.startDate = startDate
        specBooking.endDate = endDate
    }
    return res.status(200).json(specBooking)
})

router.delete('/:bookingId',async (req, res)=>{
    const currUser = req.user.id
    let today = new Date().toISOString().slice(0, 10)
    const booking = await Booking.findByPk(Number(req.params.bookingId))
    if(!booking){
        return res.status(403).json({
            "message": "Booking couldn't be found"
          })
    }
    if(new Date(booking.startDate) < today){
        return res.status(404).json({
            "message": "Bookings that have been started can't be deleted"
          })
    }
    if(booking.userId === currUser){
        await booking.destroy()
        return res.status(200).json({
            "message": "Successfully deleted"
          })
    }else{
        return res.json({message:'only owner can delete'})
    }

})


module.exports=router