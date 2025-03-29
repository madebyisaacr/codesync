// Welcome to Code in Framer
// Get Started: https://www.framer.com/developers

import { addPropertyControls, ControlType } from "framer"
import { motion } from "framer-motion"

/**
 * These annotations control how your component sizes
 * Learn more: https://www.framer.com/developers/components/auto-sizing
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 */
export default function CodeSyncTest(props) {
    const { tint } = props

    return (
        <motion.div
            style={{
                ...boxStyle,
                backgroundColor: tint,
            }}
            animate={{ scale: 1.25 }}
            whileHover={{ rotate: 90 }}
        />
    )
}

addPropertyControls(CodeSyncTest, {
    tint: {
        title: "Tint",
        type: ControlType.Color,
        defaultValue: "#09F",
    },
})

// Styles are written in object syntax
// https://react.dev/reference/react-dom/components/common#usage
const boxStyle = {
    margin: 25,
    width: 125,
    height: 125,
    borderRadius: 25,
}
