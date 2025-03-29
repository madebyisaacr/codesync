import cx from "classnames";
import styles from "./spinner.module.css";

export interface SpinnerProps {
	/** Set the spinner to have a static position inline with other content */
	inline?: boolean;
	className?: string;
}

export const Spinner = ({ inline = false, className, ...rest }: SpinnerProps) => {
	return (
		<div
			className={cx(
				className,
				styles.spin,
				styles.baseStyle,
				styles.normalStyle,
				styles.systemStyle,
				!inline && styles.centeredStyle
			)}
			{...rest}
		/>
	);
};
