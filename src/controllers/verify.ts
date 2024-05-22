import type { RequestHandler } from 'express';
import validator from 'validator';
import nodemailer from 'nodemailer';
import UsersModel from '@/models/user';
import { generateEmailToken } from '@/utils';

export const checkEmailExists: RequestHandler = async (req, res, next) => {
    try {
        const email = req.body.email;

        if (!validator.isEmail(email)) {
            throw new Error('Email 格式不正確');
        }

        const result = await UsersModel.findOne({ email });

        res.send({
            status: true,
            result: {
                isEmailExists: Boolean(result)
            }
        });
    } catch (error) {
        next();
    }
};

export const sendVerificationCode: RequestHandler = async (req, res, next) => {
    try {
        const email = req.body.email;
        const { code, token } = generateEmailToken();

        const user = await UsersModel.findOneAndUpdate(
            {
                email
            },
            {
                verificationToken: token
            },
            {
                new: true
            }
        );

        if (user) {
            const transporter = await getTransporter();

            await transporter.sendMail({
                from: process.env.EMAILER_USER,
                to: email,
                subject: 'Node 驗證碼',
                html: `<p>使用 ${code} 做為 Node 帳戶密碼安全性驗證碼</p>`
            });
        }

        res.send({
            status: true
        });
    } catch (error) {
        next(error);
    }
};

const getTransporter = async () => {
    const { EMAILER_USER, EMAILER_PASSWORD } = process.env;

    if (!EMAILER_USER || !EMAILER_PASSWORD) {
        throw new Error('Email 服務未啟用');
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAILER_USER,
            pass: EMAILER_PASSWORD
        }
    });

    await transporter.verify();

    return transporter;
};

export const sendOrderEmail: RequestHandler = async (req, res, next) => {
    try {
        const orderEmail = req.body.email;
        const orderName = req.body.name;
        const userID = req.user!['_id'] ;
        const { token } = generateEmailToken();
    
        // 查詢 -訂購時，使用的會員信箱 (非訂購人信箱)
        const user = await UsersModel.findOneAndUpdate(
            {
                "_id" : userID
            },
            {
                verificationToken: token
            },
            {
                new: true
            }
        );

        // 會員、訂購人信箱相同
        if (user && user.email === orderEmail) {
            const transporter = await getTransporter();
            await transporter.sendMail({
                from: process.env.EMAILER_USER,
                to: orderEmail,
                subject: '🌿 享樂飯店 - 訂購成功信',
                html: `<p>Hi 親愛的會員 ${user.name}：</p>
                       <p>您已訂購成功!</p>`
            });
            
        }else{
            // 會員、訂購人信箱不同，則寄給訂購人、cc 會員
            const transporter = await getTransporter();
            await transporter.sendMail({
                from: process.env.EMAILER_USER,
                to: orderEmail,
                cc: user!.email,
                subject: '🌿 享樂飯店 - 訂購成功信',
                html: `
                <p>Hi 親愛的朋友 ${orderName}，您已訂購成功!</p>
                <p>歡迎加入會員!</p>
                `
            });
        }

        res.send({
            status: true
        });
    } catch (error) {
        next(error);
    }
};
